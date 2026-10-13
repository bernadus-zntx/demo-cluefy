const baseUrl = (process.env.CLUEFY_API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const apiKey = process.env.CRAWLER_API_KEY;
const runOnce = process.argv.includes("--once");
const cycleMs = 10 * 60 * 1000;

if (!apiKey) throw new Error("CRAWLER_API_KEY belum tersedia.");

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

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

function feedQuery(rule) {
  const value = rule.value.replace(/^#|^@/, "").trim();
  if (rule.type === "URL") {
    let host = value;
    try { host = new URL(value.includes("://") ? value : `https://${value}`).hostname; } catch { host = value; }
    return `site:${host} (Badung OR Kuta OR Canggu) when:30d`;
  }
  if (rule.type === "Penulis") return `"${value}" (Badung OR Bali) when:30d`;
  if (rule.type === "Keyword" || rule.type === "Hashtag") return `${value} when:30d`;
  return null;
}

function classify(content) {
  const value = content.toLowerCase();
  const topics = [
    ["Sampah & Kebersihan", /sampah|kebersihan|limbah|tpa|bersih/],
    ["Kemacetan & Transportasi", /macet|kemacetan|lalu lintas|transportasi|angkutan|parkir/],
    ["Banjir & Drainase", /banjir|drainase|genangan/],
    ["Jalan & Infrastruktur", /jalan rusak|infrastruktur|jembatan|trotoar|penerangan/],
    ["Layanan Publik", /pelayanan|layanan publik|ktp|dukcapil|pajak|perizinan|dpmptsp|bapenda/],
    ["Pariwisata", /pariwisata|wisatawan|turis|hotel|pantai|destinasi/],
  ];
  const topic = topics.find(([, pattern]) => pattern.test(value))?.[0] || null;
  const negative = /keluhan|dikeluhkan|masalah|buruk|rusak|macet|banjir|sampah|krisis|korupsi|protes|kecelakaan/.test(value);
  const positive = /apresiasi|berhasil|baik|meningkat|penghargaan|diresmikan|membaik|prestasi/.test(value);
  const sentiment = negative && !positive ? "Negative" : positive && !negative ? "Positive" : null;
  const severity = /darurat|korban|bencana|krisis|fatal/.test(value) ? "Critical" : negative ? "High" : topic ? "Medium" : null;
  const locations = ["Kuta Selatan", "Kuta Utara", "Abiansemal", "Mengwi", "Petang", "Kuta", "Canggu", "Badung"];
  const location = locations.find(name => value.includes(name.toLowerCase())) || null;
  return { topic, sentiment, severity, location };
}

function parseFeed(xml, rule) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 12).flatMap(block => {
    const title = text(tag(block, "title"));
    const url = text(tag(block, "link"));
    if (!title || !url) return [];
    const publisher = source(block) || title.split(" - ").at(-1) || "Google News";
    const cleanTitle = title.endsWith(` - ${publisher}`) ? title.slice(0, -(publisher.length + 3)) : title;
    const excerpt = text(tag(block, "description"));
    const publishedAt = tag(block, "pubDate");
    const externalId = text(tag(block, "guid")) || url;
    const analysis = classify(`${cleanTitle} ${excerpt}`);
    return [{
      ruleId: rule.id, source: `Google News RSS · ${publisher}`, externalId, url, title: cleanTitle,
      publisher, platform: "Media Online", language: "id", country: "Indonesia",
      location: analysis.location || undefined, publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      rawPayload: {
        adapter: "google-news-rss", queryRule: rule.code, topic: analysis.topic, sentiment: analysis.sentiment,
        severity: analysis.severity, sourceGroup: "Media Konvensional", evidenceType: "Media Publik",
        sourceNote: "Konten ditemukan melalui Google News RSS. URL publikasi dan waktu capture disimpan sebagai evidence.",
        ai: analysis.topic || analysis.sentiment ? { summary: cleanTitle, recommendation: "Review isi dan sumber asli sebelum menentukan tindak lanjut.", confidence: 0.45, entities: analysis.location ? [analysis.location] : [] } : undefined,
      },
    }];
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.error || response.statusText}`);
  return payload;
}

async function crawlRule(rule) {
  const query = feedQuery(rule);
  if (!query) return { rule, items: [], skipped: `Adapter ${rule.type} memerlukan API provider.` };
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const response = await fetch(feedUrl, { headers: { "User-Agent": "ClueFyCrawler/1.0 (+public-news-monitoring)" } });
  if (!response.ok) throw new Error(`${rule.code}: feed ${response.status}`);
  return { rule, items: parseFeed(await response.text(), rule) };
}

async function cycle() {
  const rulePayload = await api("/api/crawler/rules", { headers: { Authorization: `Bearer ${apiKey}` } });
  const rules = rulePayload.rules || [];
  const runPayload = await api("/api/crawler/runs", { method: "POST", body: JSON.stringify({ rulesRequested: rules.length, metadata: { worker: "cluefy-google-news", started: new Date().toISOString() } }) });
  const runId = runPayload.run.id;
  let received = 0, inserted = 0, duplicate = 0, revised = 0;
  const errors = [], skipped = [];
  try {
    for (const rule of rules) {
      try {
        const result = await crawlRule(rule);
        if (result.skipped) { skipped.push(`${rule.code}: ${result.skipped}`); continue; }
        received += result.items.length;
        if (!result.items.length) continue;
        const ingested = await api("/api/crawler/ingest", { method: "POST", body: JSON.stringify({ items: result.items }) });
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
