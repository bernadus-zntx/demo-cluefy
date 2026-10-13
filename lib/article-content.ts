const browserHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
};

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lsquo;|&rsquo;/gi, "'").replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;/gi, "–").replace(/&mdash;/gi, "—").replace(/&hellip;/gi, "…");
}

function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL sumber harus memakai HTTP atau HTTPS.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('URL sumber internal tidak dapat diambil.');
  return url;
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export async function resolvePublisherUrl(value: string) {
  const url = assertPublicHttpUrl(value);
  if (url.hostname !== "news.google.com") return value;
  const encodedId = url.pathname.split("/").filter(Boolean).at(-1);
  if (!encodedId) return value;

  const page = await fetch(`https://news.google.com/rss/articles/${encodedId}`, {
    headers: { ...browserHeaders, Cookie: "CONSENT=PENDING+987" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!page.ok) return value;
  const html = await page.text();
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  const articleId = html.match(/data-n-a-id="([^"]+)"/)?.[1] || encodedId;
  if (!signature || !timestamp) return value;

  const requestPayload = [
    "garturlreq",
    [["en-US", "US", ["FINANCE_TOP_INDICES", "WEB_TEST_1_0_0"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "en-US", "US", 1, [2, 3, 4, 8], 1, 0, "655000234", 0, 0, null, 0],
    articleId,
    Number(timestamp),
    signature,
  ];
  const rpcPayload = JSON.stringify([[['Fbv4je', JSON.stringify(requestPayload), null, 'generic']]]);
  const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
    method: "POST",
    headers: { ...browserHeaders, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Referer: "https://news.google.com/" },
    body: new URLSearchParams({ "f.req": rpcPayload }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return value;
  const body = await response.text();
  const marker = '[\\"garturlres\\",\\"';
  const start = body.indexOf(marker);
  if (start < 0) return value;
  const rest = body.slice(start + marker.length);
  const publisherUrl = rest.slice(0, rest.indexOf('\\",')).replace(/\\u003d/g, "=").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  return /^https?:\/\//.test(publisherUrl) ? publisherUrl : value;
}

export function extractArticleContent(html: string) {
  const articleBody = html.match(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1];
  if (articleBody) {
    try {
      const parsed = JSON.parse(`"${articleBody}"`);
      const clean = plainText(parsed);
      if (clean.length >= 120) return clean.slice(0, 12_000);
    } catch { /* continue with metadata and paragraph extraction */ }
  }

  const descriptionPatterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
  ];
  for (const pattern of descriptionPatterns) {
    const description = plainText(html.match(pattern)?.[1] || "");
    if (description.length >= 120) return description.slice(0, 12_000);
  }

  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map(match => plainText(match[1]))
    .filter(value => value.length >= 80 && !/cookie|privacy policy|subscribe|newsletter/i.test(value));
  return Array.from(new Set(paragraphs)).join("\n\n").slice(0, 12_000);
}

export async function fetchArticleContent(value: string) {
  const publisherUrl = await resolvePublisherUrl(value);
  assertPublicHttpUrl(publisherUrl);
  const response = await fetch(publisherUrl, { headers: browserHeaders, redirect: "follow", signal: AbortSignal.timeout(18_000) });
  if (!response.ok) throw new Error(`Publisher merespons ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("Sumber tidak menyediakan halaman artikel HTML.");
  const content = extractArticleContent(await response.text());
  if (!content) throw new Error("Isi artikel tidak dapat diekstrak dari publisher ini.");
  return { publisherUrl: response.url || publisherUrl, content };
}
