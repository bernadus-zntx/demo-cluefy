const baseUrl = (process.env.CLUEFY_API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const apiKey = process.env.CRAWLER_API_KEY;
const runOnce = process.argv.includes("--once");
const cycleMs = 10 * 60 * 1000;

if (!apiKey) throw new Error("CRAWLER_API_KEY belum tersedia.");

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
const translationCache = new Map();

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function text(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

function feedQuery(rule, profile) {
  const value = rule.value.replace(/^#|^@/, "").trim();
  const window = profile.language === "id" ? "30d" : "365d";
  if (rule.type === "URL") {
    let host = value;
    try { host = new URL(value.includes("://") ? value : `https://${value}`).hostname; } catch { host = value; }
    return `site:${host} (Badung OR Kuta OR Canggu OR Seminyak OR "Nusa Dua") when:${window}`;
  }
  if (rule.type === "Penulis") return `"${value}" (Badung OR Bali) when:${window}`;
  if (rule.type === "Keyword" || rule.type === "Hashtag") return `${value} when:${window}`;
  return null;
}

function classify(content) {
  const value = content.toLowerCase();
  const topics = [
    ["Sampah & Kebersihan", /sampah|kebersihan|limbah|tpa|bersih|waste|trash|rubbish|pollution|garbage/],
    ["Kemacetan & Transportasi", /macet|kemacetan|lalu lintas|transportasi|angkutan|parkir|traffic|congestion|transport|fuel shortage/],
    ["Banjir & Drainase", /banjir|drainase|genangan|flood|flooding|drainage/],
    ["Jalan & Infrastruktur", /jalan rusak|infrastruktur|jembatan|trotoar|penerangan|infrastructure|\broads?\b|bridge|development/],
    ["Layanan Publik", /pelayanan|layanan publik|ktp|dukcapil|pajak|perizinan|dpmptsp|bapenda|public service|authority|government service/],
    ["Pariwisata", /pariwisata|wisatawan|turis|hotel|pantai|destinasi|tourism|tourist|travel|resort|beach|holiday/],
  ];
  const topic = topics.find(([, pattern]) => pattern.test(value))?.[0] || null;
  const negative = /keluhan|dikeluhkan|masalah|buruk|rusak|macet|banjir|sampah|krisis|korupsi|protes|kecelakaan|complaint|problem|severe|shortage|crime|killed|death|pollution|overcrowd/.test(value);
  const positive = /apresiasi|berhasil|baik|meningkat|penghargaan|diresmikan|membaik|prestasi|improve|award|success|revive|distinctive/.test(value);
  const sentiment = negative && !positive ? "Negative" : positive && !negative ? "Positive" : null;
  const severity = /darurat|korban|bencana|krisis|fatal/.test(value) ? "Critical" : negative ? "High" : topic ? "Medium" : null;
  const locations = ["Kuta Selatan", "Kuta Utara", "Abiansemal", "Mengwi", "Petang", "Nusa Dua", "Tanjung Benoa", "Seminyak", "Uluwatu", "Jimbaran", "Legian", "Kerobokan", "Kuta", "Canggu", "Badung"];
  const location = locations.find(name => value.includes(name.toLowerCase())) || null;
  return { topic, sentiment, severity, location };
}

function isRelevantForeignContent(content) {
  return /badung|kuta|canggu|seminyak|nusa dua|tanjung benoa|uluwatu|jimbaran|legian|kerobokan|bali|バリ|クタ|チャングー|バドゥン/i.test(content);
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

async function parseFeed(xml, rule, existingTranslations) {
  const profile = feedProfile(rule);
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const candidates = blocks.slice(0, 12).flatMap(block => {
    const title = text(tag(block, "title"));
    const url = text(tag(block, "link"));
    if (!title || !url) return [];
    const publisher = source(block) || title.split(" - ").at(-1) || "Google News";
    const cleanTitle = title.endsWith(` - ${publisher}`) ? title.slice(0, -(publisher.length + 3)) : title;
    const excerpt = text(tag(block, "description"));
    if (profile.language !== "id" && !isRelevantForeignContent(`${cleanTitle} ${excerpt}`)) return [];
    const publishedAt = tag(block, "pubDate");
    const externalId = text(tag(block, "guid")) || url;
    const analysis = classify(`${cleanTitle} ${excerpt}`);
    return [{
      ruleId: rule.id, source: `Google News RSS · ${publisher}`, externalId, url, title: cleanTitle,
      publisher, platform: profile.language === "id" ? "Media Online" : "Media Asing", language: profile.language, country: profile.country,
      location: analysis.location || undefined, publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      rawPayload: {
        adapter: "google-news-rss", queryRule: rule.code, topic: analysis.topic, sentiment: analysis.sentiment,
        severity: analysis.severity, sourceGroup: "Media Konvensional", evidenceType: "Media Publik",
        sourceNote: `Konten ${profile.language === "id" ? "Indonesia" : `berbahasa ${profile.language.toUpperCase()}`} ditemukan melalui Google News RSS. URL publikasi dan waktu capture disimpan sebagai evidence.`,
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

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.error || response.statusText}`);
  return payload;
}

async function crawlRule(rule, existingTranslations) {
  const profile = feedProfile(rule);
  const query = feedQuery(rule, profile);
  if (!query) return { rule, items: [], skipped: `Adapter ${rule.type} memerlukan API provider.` };
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${profile.hl}&gl=${profile.gl}&ceid=${profile.ceid}`;
  const response = await fetch(feedUrl, { headers: { "User-Agent": "ClueFyCrawler/1.0 (+public-news-monitoring)" } });
  if (!response.ok) throw new Error(`${rule.code}: feed ${response.status}`);
  return { rule, items: await parseFeed(await response.text(), rule, existingTranslations) };
}

async function cycle() {
  const livePayload = await api("/api/intelligence/live").catch(() => ({ items: [] }));
  const existingTranslations = new Map((livePayload.items || []).flatMap(item => item.externalId && item.translation ? [[item.externalId, item.translation]] : []));
  const rulePayload = await api("/api/crawler/rules", { headers: { Authorization: `Bearer ${apiKey}` } });
  const rules = rulePayload.rules || [];
  const runPayload = await api("/api/crawler/runs", { method: "POST", body: JSON.stringify({ rulesRequested: rules.length, metadata: { worker: "cluefy-google-news", started: new Date().toISOString() } }) });
  const runId = runPayload.run.id;
  let received = 0, inserted = 0, duplicate = 0, revised = 0;
  const errors = [], skipped = [];
  try {
    for (const rule of rules) {
      try {
        const result = await crawlRule(rule, existingTranslations);
        if (result.skipped) { skipped.push(`${rule.code}: ${result.skipped}`); continue; }
        received += result.items.length;
        if (!result.items.length) continue;
        const ingested = await api("/api/crawler/ingest", { method: "POST", body: JSON.stringify({ items: result.items }) });
        const enrichments = (ingested.results || []).flatMap((stored, index) => {
          const crawled = result.items[index];
          const translation = crawled?.rawPayload?.translation;
          return stored.item_id && crawled?.translationNeedsSave && translation
            ? [{ id: stored.item_id, translation, provider: crawled.rawPayload.translationProvider }]
            : [];
        });
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
    const status = errors.length ? (received ? "partial" : "failed") : "completed";
    await api("/api/crawler/runs", { method: "PATCH", body: JSON.stringify({ id: runId, status, itemsReceived: received, itemsInserted: inserted, itemsDuplicate: duplicate, itemsRevised: revised, errorMessage: errors.join(" | ") || null }) });
    console.log(JSON.stringify({ status, rules: rules.length, received, inserted, duplicate, revised, skipped, errors }, null, 2));
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
