const baseUrl = (process.env.CLUEFY_API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const apiKey = process.env.CRAWLER_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-6-luna";
const aiMaxItems = Math.max(0, Number(process.env.AI_ENRICH_MAX_ITEMS || 25));
const runOnce = process.argv.includes("--once");
const cycleMs = 10 * 60 * 1000;
const crawlSince = new Date(process.env.CRAWLER_SINCE || "2026-10-01T00:00:00+08:00");
const crawlSinceLabel = crawlSince.toISOString().slice(0, 10);

if (!apiKey) throw new Error("CRAWLER_API_KEY belum tersedia.");

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
const translationCache = new Map();

const aiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" }, relevanceReason: { type: "string" }, summary: { type: "string" },
    finding: { type: "string" }, recommendation: { type: "string" },
    topic: { type: "string", enum: ["Sampah & Kebersihan", "Kemacetan & Transportasi", "Banjir & Drainase", "Jalan & Infrastruktur", "Layanan Publik", "Pariwisata", "Keamanan & Ketertiban", "Kesehatan", "Pendidikan", "Ekonomi & UMKM", "Belum diklasifikasi"] },
    sentiment: { type: "string", enum: ["Positive", "Neutral", "Negative"] },
    emotion: { type: "string" }, severity: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
    location: { type: "string" }, village: { type: "string" }, actor: { type: "string" },
    entities: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 },
    translation: { type: "string" },
  },
  required: ["relevant", "relevanceReason", "summary", "finding", "recommendation", "topic", "sentiment", "emotion", "severity", "location", "village", "actor", "entities", "confidence", "translation"],
};

function responseOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function enrichWithOpenAI(item) {
  if (!openAiKey) return null;
  const sourceContent = [item.title, item.excerpt, item.body].filter(Boolean).join("\n\n").slice(0, 12000);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: openAiModel, store: false, reasoning: { effort: "none" },
      input: [
        { role: "system", content: "Anda adalah analis media ClueFy untuk Pemerintah Kabupaten Badung. Analisis hanya dari bukti yang diberikan. Tulis ringkasan, temuan, rekomendasi, dan alasan relevansi dalam Bahasa Indonesia yang singkat dan operasional. Field translation khusus untuk terjemahan ke Bahasa Indonesia: bila language adalah id, id-ID, Indonesian, atau Bahasa Indonesia, translation wajib string kosong; jangan pernah menerjemahkan konten Indonesia ke bahasa lain. relevant hanya true bila konten berdampak atau berkaitan nyata dengan Badung, Kuta, Canggu, Seminyak, Nusa Dua, Jimbaran, Uluwatu, Legian, Kerobokan, atau layanan Pemkab Badung. Untuk data yang tidak tersedia gunakan string kosong; jangan mengarang nama orang, desa, atau lokasi." },
        { role: "user", content: JSON.stringify({
          title: item.title || "", content: sourceContent, publisher: item.publisher || "", author: item.author || "",
          language: item.language || "", country: item.country || "", detectedLocation: item.location || "",
          initialClassification: item.rawPayload ? { topic: item.rawPayload.topic || "", sentiment: item.rawPayload.sentiment || "", severity: item.rawPayload.severity || "" } : {},
        }) },
      ],
      text: { format: { type: "json_schema", name: "cluefy_article_enrichment", strict: true, schema: aiSchema } },
      max_output_tokens: 1200,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${payload?.error?.message || response.statusText}`);
  const output = responseOutputText(payload);
  if (!output) throw new Error("OpenAI tidak mengembalikan structured output.");
  const parsed = JSON.parse(output);
  return { ...parsed, confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)) };
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&lsquo;/g, "‘").replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function text(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function directArticleUrl(rule) {
  if (rule.type !== "URL" || !/direct article|artikel langsung/i.test(`${rule.source || ""} ${rule.note || ""}`)) return null;
  try {
    const url = new URL(rule.value.includes("://") ? rule.value : `https://${rule.value}`);
    return url.pathname && url.pathname !== "/" ? url.toString() : null;
  } catch {
    return null;
  }
}

function jsonLdArticles(html) {
  const values = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      values.push(...nodes.filter(Boolean));
    } catch { /* Publisher JSON-LD can contain non-JSON markup. */ }
  }
  return values.filter(value => /article/i.test(Array.isArray(value?.["@type"]) ? value["@type"].join(" ") : String(value?.["@type"] || "")));
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  return text(patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean) || "");
}

function publisherFromUrl(url, article) {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const known = { "aif.ru": "Аргументы и Факты" };
  const publisher = Array.isArray(article?.publisher) ? article.publisher[0] : article?.publisher;
  return text(publisher?.name || publisher || known[hostname] || hostname);
}

function tag(block, name) {
  return decodeXml(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "").trim();
}

function source(block) {
  return text(block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i)?.[1] || "");
}

function feedProfile(rule) {
  const hint = `${rule.source || ""} ${rule.scope || ""} ${rule.note || ""}`.toLowerCase();
  const profiles = [
    { match: /rusia|russia|russian|russki|рус|русский/, hl: "ru", gl: "RU", ceid: "RU:ru", language: "ru", country: "Rusia" },
    { match: /ukraina|ukraine|ukrainian|україн|украин/, hl: "uk", gl: "UA", ceid: "UA:uk", language: "uk", country: "Ukraina" },
    { match: /amerika serikat|united states|\busa\b|american/, hl: "en-US", gl: "US", ceid: "US:en", language: "en", country: "Amerika Serikat" },
    { match: /jepang|japan|japanese|日本|日本語/, hl: "ja", gl: "JP", ceid: "JP:ja", language: "ja", country: "Jepang" },
    { match: /prancis|france|french|français/, hl: "fr", gl: "FR", ceid: "FR:fr", language: "fr", country: "Prancis" },
    { match: /jerman|germany|german|deutsch/, hl: "de", gl: "DE", ceid: "DE:de", language: "de", country: "Jerman" },
    { match: /hong kong/, hl: "en-HK", gl: "HK", ceid: "HK:en", language: "en", country: "Hong Kong" },
    { match: /singapura|singapore/, hl: "en-SG", gl: "SG", ceid: "SG:en", language: "en", country: "Singapura" },
    { match: /inggris|united kingdom|british/, hl: "en-GB", gl: "GB", ceid: "GB:en", language: "en", country: "Inggris" },
    { match: /australia/, hl: "en-AU", gl: "AU", ceid: "AU:en", language: "en", country: "Australia" },
  ];
  const selected = profiles.find(profile => profile.match.test(hint));
  const foreign = Boolean(selected || /media asing|foreign|international|english/.test(hint));
  return selected || (foreign
    ? { hl: "en-US", gl: "US", ceid: "US:en", language: "en", country: "Internasional" }
    : { hl: "id", gl: "ID", ceid: "ID:id", language: "id", country: "Indonesia" });
}

const socialPlatforms = [
  { match: /instagram/i, platform: "Instagram", site: "instagram.com/p" },
  { match: /tiktok/i, platform: "TikTok", site: "tiktok.com/@" },
  { match: /facebook/i, platform: "Facebook", site: "facebook.com" },
  { match: /youtube/i, platform: "YouTube", site: "youtube.com/watch" },
  { match: /reddit/i, platform: "Reddit", site: "reddit.com/r" },
  { match: /(?:^|\W)(?:x|twitter)(?:\W|$)/i, platform: "X", site: "x.com" },
];

function configuredSocialPlatforms(rule) {
  const hint = `${rule.source || ""} ${rule.note || ""}`;
  return socialPlatforms.filter(item => item.match.test(hint));
}

function feedQueries(rule) {
  const value = rule.value.replace(/^#|^@/, "").trim();
  const window = `after:${crawlSinceLabel}`;
  const social = configuredSocialPlatforms(rule);
  if (["Akun Social", "Group Social"].includes(rule.type) || (rule.type === "Hashtag" && social.length)) {
    const platforms = social.length ? social : socialPlatforms.filter(item => item.platform === "Instagram");
    return platforms.map(item => ({
      query: `site:${item.site} "${value}" ${window}`,
      social: item,
    }));
  }
  if (rule.type === "URL") {
    let host = value;
    try { host = new URL(value.includes("://") ? value : `https://${value}`).hostname; } catch { host = value; }
    return [{ query: `site:${host} (Badung OR Kuta OR Canggu OR Seminyak OR "Nusa Dua") ${window}` }];
  }
  if (rule.type === "Penulis") return [{ query: `"${value}" (Badung OR Bali) ${window}` }];
  if (rule.type === "Keyword" || rule.type === "Hashtag") return [{ query: `${value} ${window}` }];
  return [];
}

function classify(content) {
  const value = content.toLowerCase();
  const topics = [
    ["Sampah & Kebersihan", /sampah|kebersihan|limbah|tpa|bersih|waste|trash|rubbish|pollution|garbage|мусор|отход|сміття|відход/],
    ["Kemacetan & Transportasi", /macet|kemacetan|lalu lintas|transportasi|angkutan|parkir|traffic|congestion|transport|fuel shortage|пробк|затор|транспорт|топлив|пальн/],
    ["Banjir & Drainase", /banjir|drainase|genangan|flood|flooding|drainage|наводнен|повінь/],
    ["Jalan & Infrastruktur", /jalan rusak|infrastruktur|jembatan|trotoar|penerangan|infrastructure|\broads?\b|bridge|development/],
    ["Layanan Publik", /pelayanan|layanan publik|ktp|dukcapil|pajak|perizinan|dpmptsp|bapenda|public service|authority|government service/],
    ["Pariwisata", /pariwisata|wisatawan|turis|hotel|pantai|destinasi|tourism|tourist|travel|resort|beach|holiday|туризм|турист|пляж/],
  ];
  const topic = topics.find(([, pattern]) => pattern.test(value))?.[0] || null;
  const negative = /keluhan|dikeluhkan|masalah|buruk|rusak|macet|banjir|sampah|krisis|korupsi|protes|kecelakaan|complaint|problem|severe|shortage|crime|killed|death|pollution|overcrowd|кризис|криза|проблем|дефицит|дефіцит|авар|пожар|пожеж/.test(value);
  const positive = /apresiasi|berhasil|baik|meningkat|penghargaan|diresmikan|membaik|prestasi|improve|award|success|revive|distinctive/.test(value);
  const sentiment = negative && !positive ? "Negative" : positive && !negative ? "Positive" : null;
  const severity = /darurat|korban|bencana|krisis|fatal/.test(value) ? "Critical" : negative ? "High" : topic ? "Medium" : null;
  const locations = [
    ["Kuta Selatan", /kuta selatan|южн[^ ]* кут/], ["Kuta Utara", /kuta utara|северн[^ ]* кут/],
    ["Abiansemal", /abiansemal/], ["Mengwi", /mengwi/], ["Petang", /\bpetang\b/], ["Nusa Dua", /nusa dua|нуса[ -]дуа/],
    ["Tanjung Benoa", /tanjung benoa/], ["Seminyak", /seminyak|семиньяк/], ["Uluwatu", /uluwatu|улувату/],
    ["Jimbaran", /jimbaran|джимбаран/], ["Legian", /legian|легиан/], ["Kerobokan", /kerobokan|керобокан/],
    ["Kuta", /\bkuta\b|кута/], ["Canggu", /canggu|чангу/], ["Badung", /badung|бадунг|бадунзі/],
  ];
  const location = locations.find(([, pattern]) => pattern.test(value))?.[0] || null;
  return { topic, sentiment, severity, location };
}

function isRelevantForeignContent(content) {
  return /badung|kuta|canggu|seminyak|nusa dua|tanjung benoa|uluwatu|jimbaran|legian|kerobokan|bali|バリ|クタ|チャングー|バドゥン|бали|балі|кута|чангу|бадунг|семиньяк|нуса-дуа/i.test(content);
}

async function translateFallback(value, language) {
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.search = new URLSearchParams({ q: value, langpair: `${language}|id` }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "ClueFyCrawler/1.0 (+public-news-monitoring)" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const payload = await response.json();
    const translated = typeof payload?.responseData?.translatedText === "string" ? payload.responseData.translatedText.trim() : "";
    return translated && translated.toLowerCase() !== value.toLowerCase() ? translated : null;
  } catch {
    return null;
  }
}

async function translateBatchToIndonesian(values, language) {
  if (!values.length || language === "id") return values.map(() => null);
  const results = values.map(value => translationCache.get(`${language}:${value}`) || null);
  const missing = values.map((value, index) => ({ value, index })).filter(({ index }) => !results[index]);
  if (!missing.length) return results;
  try {
    const tagged = missing.map(({ value }, index) => `[[${index}]] ${value}`).join("\n");
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.search = new URLSearchParams({ client: "gtx", sl: language, tl: "id", dt: "t", q: tagged }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "ClueFyCrawler/1.0 (+public-news-monitoring)" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`translation ${response.status}`);
    const payload = await response.json();
    const translatedText = Array.isArray(payload?.[0]) ? payload[0].map(part => Array.isArray(part) ? part[0] || "" : "").join("").trim() : "";
    const translatedByIndex = new Map();
    for (const match of translatedText.matchAll(/\[\[(\d+)\]\]\s*([\s\S]*?)(?=\n?\[\[\d+\]\]|$)/g)) {
      translatedByIndex.set(Number(match[1]), match[2].trim());
    }
    for (let position = 0; position < missing.length; position++) {
      const item = missing[position];
      const translated = translatedByIndex.get(position) || null;
      if (translated && translated.toLowerCase() !== item.value.toLowerCase()) results[item.index] = translated;
    }
  } catch (error) {
    console.warn(`Terjemahan batch gagal (${language}): ${error instanceof Error ? error.message : String(error)}. Menggunakan provider cadangan.`);
    for (const item of missing) results[item.index] = await translateFallback(item.value, language);
  }
  values.forEach((value, index) => translationCache.set(`${language}:${value}`, results[index]));
  return results;
}

async function parseFeed(xml, rule, existingTranslations, social = null) {
  const profile = feedProfile(rule);
  const isSocial = Boolean(social);
  const configuredAccount = ["Akun Social", "Group Social"].includes(rule.type) ? `@${rule.value.replace(/^@/, "")}` : null;
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const candidates = blocks.slice(0, 12).flatMap(block => {
    const title = text(tag(block, "title"));
    const url = text(tag(block, "link"));
    if (!title || !url) return [];
    const indexedPublisher = source(block) || title.split(" - ").at(-1) || "Google News";
    const cleanTitle = title.endsWith(` - ${indexedPublisher}`) ? title.slice(0, -(indexedPublisher.length + 3)) : title;
    const publisher = isSocial ? configuredAccount || `${social.platform} Public` : indexedPublisher;
    const excerpt = text(tag(block, "description"));
    if (profile.language !== "id" && !isRelevantForeignContent(`${cleanTitle} ${excerpt}`)) return [];
    const publishedAt = tag(block, "pubDate");
    const publishedDate = publishedAt ? new Date(publishedAt) : null;
    if (publishedDate && Number.isFinite(publishedDate.getTime()) && publishedDate < crawlSince) return [];
    const externalId = text(tag(block, "guid")) || url;
    const analysis = classify(`${cleanTitle} ${excerpt}`);
    return [{
      ruleId: rule.id, source: isSocial ? `Public Crawl · ${social.platform}` : `Google News RSS · ${publisher}`, externalId, url, title: cleanTitle,
      author: isSocial ? configuredAccount || undefined : rule.type === "Penulis" ? rule.value : undefined,
      publisher, platform: isSocial ? social.platform : profile.language === "id" ? "Media Online" : "Media Asing", language: profile.language, country: profile.country,
      location: analysis.location || undefined, publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      rawPayload: {
        adapter: isSocial ? "public-social-index" : "google-news-rss", queryRule: rule.code, topic: analysis.topic, sentiment: analysis.sentiment,
        severity: analysis.severity, sourceGroup: isSocial ? "Social Media" : "Media Konvensional", evidenceType: isSocial ? "Percakapan Publik" : "Media Publik",
        discoveryMethod: isSocial ? "public-search-index" : "google-news-rss",
        connectionType: isSocial ? "Public Crawl" : "RSS",
        sourceNote: isSocial
          ? `Posting publik ${social.platform} ditemukan melalui indeks publik tanpa login. Caption, URL indeks, akun target, dan waktu publikasi disimpan sebagai evidence; ketersediaannya mengikuti kebijakan platform.`
          : `Konten ${profile.language === "id" ? "Indonesia" : `berbahasa ${profile.language.toUpperCase()}`} ditemukan melalui Google News RSS. URL publikasi dan waktu capture disimpan sebagai evidence.`,
        ai: analysis.topic || analysis.sentiment ? { summary: cleanTitle, recommendation: "Review isi dan sumber asli sebelum menentukan tindak lanjut.", confidence: 0.45, entities: analysis.location ? [analysis.location] : [] } : undefined,
      },
    }];
  });
  const generated = await translateBatchToIndonesian(
    candidates.filter(item => item.language !== "id" && !existingTranslations.get(item.externalId)).map(item => item.title),
    profile.language,
  );
  let generatedIndex = 0;
  return candidates.map(item => {
    if (item.language === "id") return item;
    const existing = existingTranslations.get(item.externalId);
    const translation = existing || generated[generatedIndex++] || null;
    return {
      ...item,
      translationNeedsSave: Boolean(translation && !existing),
      rawPayload: {
        ...item.rawPayload,
        translation,
        translationProvider: translation ? "Automated translation demo" : undefined,
      },
    };
  });
}

async function crawlDirectArticle(rule, existingTranslations) {
  const url = directArticleUrl(rule);
  if (!url) return null;
  const profile = feedProfile(rule);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ClueFyCrawler/1.0; +public-news-monitoring)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${rule.code}: artikel ${response.status}`);
  const html = await response.text();
  const article = jsonLdArticles(html)[0] || {};
  const title = text(article.headline || metaContent(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = text(article.description || metaContent(html, "og:description") || metaContent(html, "description"));
  const body = text(article.articleBody || "");
  const canonical = text(article.mainEntityOfPage?.["@id"] || metaContent(html, "og:url")) || url;
  const authorValue = Array.isArray(article.author) ? article.author[0] : article.author;
  const author = text(authorValue?.name || authorValue || metaContent(html, "author"));
  const publisher = publisherFromUrl(canonical, article);
  const publishedValue = article.datePublished || metaContent(html, "article:published_time");
  const publishedDate = publishedValue ? new Date(publishedValue) : null;
  if (!title) throw new Error(`${rule.code}: judul artikel tidak ditemukan`);
  if (publishedDate && Number.isFinite(publishedDate.getTime()) && publishedDate < crawlSince) return { rule, items: [] };
  if (profile.language !== "id" && !isRelevantForeignContent(`${title} ${description} ${body}`)) return { rule, items: [] };
  const analysis = classify(`${title} ${description} ${body}`);
  const externalId = canonical;
  const existing = existingTranslations.get(externalId);
  const generated = existing || (await translateBatchToIndonesian([title], profile.language))[0] || null;
  return {
    rule,
    items: [{
      ruleId: rule.id,
      source: `Direct Article · ${publisher}`,
      externalId,
      url: canonical,
      title,
      excerpt: description || undefined,
      body: body || undefined,
      author: author || undefined,
      publisher,
      platform: profile.language === "id" ? "Media Online" : "Media Asing",
      language: profile.language,
      country: profile.country,
      location: analysis.location || undefined,
      publishedAt: publishedDate && Number.isFinite(publishedDate.getTime()) ? publishedDate.toISOString() : undefined,
      translationNeedsSave: Boolean(generated && !existing),
      rawPayload: {
        adapter: "direct-article",
        queryRule: rule.code,
        topic: analysis.topic,
        sentiment: analysis.sentiment,
        severity: analysis.severity,
        sourceGroup: "Media Konvensional",
        evidenceType: "Media Publik",
        sourceNote: "Artikel diambil langsung dari URL publisher. URL kanonik, byline, isi, dan waktu publikasi disimpan sebagai evidence.",
        translation: generated,
        translationProvider: generated ? "Automated translation demo" : undefined,
        ai: {
          summary: generated || title,
          recommendation: analysis.severity === "Critical" || analysis.severity === "High"
            ? "Verifikasi dampak operasional di Badung dan teruskan ke OPD terkait untuk tindak lanjut."
            : "Review isi dan sumber asli sebelum menentukan tindak lanjut.",
          confidence: body ? 0.88 : 0.72,
          entities: analysis.location ? [analysis.location] : [],
        },
      },
    }],
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.error || response.statusText}`);
  return payload;
}

async function crawlRule(rule, existingTranslations) {
  const direct = await crawlDirectArticle(rule, existingTranslations);
  if (direct) return direct;
  const profile = feedProfile(rule);
  const queries = feedQueries(rule);
  if (!queries.length) return { rule, items: [], skipped: `Adapter ${rule.type} belum memiliki sumber publik.` };
  const batches = [];
  for (const entry of queries) {
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(entry.query)}&hl=${profile.hl}&gl=${profile.gl}&ceid=${profile.ceid}`;
    const response = await fetch(feedUrl, { headers: { "User-Agent": "ClueFyCrawler/1.0 (+public-news-and-social-monitoring)" } });
    if (!response.ok) throw new Error(`${rule.code}: feed ${response.status}`);
    batches.push(...await parseFeed(await response.text(), rule, existingTranslations, entry.social));
  }
  const seen = new Set();
  return { rule, items: batches.filter(item => !seen.has(item.externalId) && seen.add(item.externalId)).slice(0, 36) };
}

async function cycle() {
  const livePayload = await api("/api/intelligence/live").catch(() => ({ items: [] }));
  const existingTranslations = new Map((livePayload.items || []).flatMap(item => item.externalId && item.translation ? [[item.externalId, item.translation]] : []));
  const rulePayload = await api("/api/crawler/rules", { headers: { Authorization: `Bearer ${apiKey}` } });
  const localePriority = rule => ({ Internasional: 0, Indonesia: 1, "Amerika Serikat": 3, Rusia: 4, Ukraina: 5 }[feedProfile(rule).country] ?? 2);
  const rules = [...(rulePayload.rules || [])].sort((a, b) => localePriority(a) - localePriority(b) || a.code.localeCompare(b.code));
  const runPayload = await api("/api/crawler/runs", { method: "POST", body: JSON.stringify({ rulesRequested: rules.length, metadata: { worker: "cluefy-google-news", started: new Date().toISOString() } }) });
  const runId = runPayload.run.id;
  let received = 0, inserted = 0, duplicate = 0, revised = 0, aiEnriched = 0, aiBackfilled = 0;
  const errors = [], skipped = [], aiErrors = [];
  try {
    for (const rule of rules) {
      try {
        const result = await crawlRule(rule, existingTranslations);
        if (process.env.CRAWLER_DEBUG === "1") console.log(`${rule.code} · ${feedProfile(rule).country} · ${result.items.length} item`);
        if (result.skipped) { skipped.push(`${rule.code}: ${result.skipped}`); continue; }
        received += result.items.length;
        if (!result.items.length) continue;
        const ingested = await api("/api/crawler/ingest", { method: "POST", body: JSON.stringify({ items: result.items }) });
        const enrichments = [];
        for (const [index, stored] of (ingested.results || []).entries()) {
          const crawled = result.items[index];
          const translation = crawled?.rawPayload?.translation;
          if (!stored.item_id) continue;
          const enrichment = { id: stored.item_id, ...(crawled?.translationNeedsSave && translation ? { translation, provider: crawled.rawPayload.translationProvider } : {}) };
          if (openAiKey && aiEnriched < aiMaxItems && ["inserted", "revised"].includes(stored.action)) {
            try {
              enrichment.ai = await enrichWithOpenAI(crawled);
              enrichment.model = openAiModel;
              aiEnriched++;
            } catch (error) {
              aiErrors.push(`${rule.code}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          if (enrichment.translation || enrichment.ai) enrichments.push(enrichment);
        }
        if (enrichments.length) {
          await api("/api/crawler/enrich", { method: "POST", body: JSON.stringify({ items: enrichments }) });
          for (const item of result.items) {
            if (item.externalId && item.rawPayload?.translation) existingTranslations.set(item.externalId, item.rawPayload.translation);
          }
        }
        for (const item of ingested.results || []) {
          if (item.action === "inserted") inserted++;
          else if (item.action === "duplicate") duplicate++;
          else if (item.action === "revised") revised++;
          else errors.push(`${rule.code}: ${item.error || item.action}`);
        }
      } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    }
    if (openAiKey && aiEnriched < aiMaxItems) {
      const backlog = (livePayload.items || []).filter(item => item.ai?.provider !== "OpenAI").slice(0, aiMaxItems - aiEnriched);
      const enrichments = [];
      for (const item of backlog) {
        try {
          const ai = await enrichWithOpenAI({ ...item, rawPayload: { topic: item.topic, sentiment: item.sentiment, severity: item.severity } });
          enrichments.push({ id: item.id, ai, model: openAiModel });
          aiEnriched++;
          aiBackfilled++;
        } catch (error) {
          aiErrors.push(`backfill ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (enrichments.length) await api("/api/crawler/enrich", { method: "POST", body: JSON.stringify({ items: enrichments }) });
    }
    const status = errors.length ? (received ? "partial" : "failed") : "completed";
    await api("/api/crawler/runs", { method: "PATCH", body: JSON.stringify({ id: runId, status, itemsReceived: received, itemsInserted: inserted, itemsDuplicate: duplicate, itemsRevised: revised, errorMessage: errors.join(" | ") || null }) });
    console.log(JSON.stringify({ status, rules: rules.length, received, inserted, duplicate, revised, aiEnriched, aiBackfilled, aiErrors, skipped, errors }, null, 2));
  } catch (error) {
    await api("/api/crawler/runs", { method: "PATCH", body: JSON.stringify({ id: runId, status: "failed", itemsReceived: received, itemsInserted: inserted, itemsDuplicate: duplicate, itemsRevised: revised, errorMessage: error instanceof Error ? error.message : String(error) }) }).catch(() => {});
    throw error;
  }
}

await cycle();
if (!runOnce) {
  console.log("Crawler aktif. Siklus berikutnya berjalan setiap 10 menit.");
  setInterval(() => cycle().catch(error => console.error(error)), cycleMs);
}
