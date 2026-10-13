import { NextRequest, NextResponse } from "next/server";
import { canonicalizeUrl, sha256, verifyCrawlerToken } from "../../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

type CrawlItem = {
  ruleId: string;
  source: string;
  externalId?: string;
  url: string;
  title: string;
  excerpt?: string;
  body?: string;
  author?: string;
  publisher?: string;
  platform?: string;
  language?: string;
  country?: string;
  location?: string;
  publishedAt?: string;
  rawPayload?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  if (!verifyCrawlerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Crawler credential tidak valid." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });

  const body = await request.json() as { items?: CrawlItem[] } | CrawlItem;
  const items: CrawlItem[] = "items" in body ? body.items ?? [] : [body as CrawlItem];
  if (!items.length || items.length > 100) return NextResponse.json({ error: "Kirim antara 1 sampai 100 item per request." }, { status: 400 });

  const results: Array<Record<string, unknown>> = [];
  for (const item of items) {
    if (!item.ruleId || !item.source || !item.url || !item.title) {
      results.push({ url: item.url, action: "rejected", error: "ruleId, source, url, dan title wajib diisi." });
      continue;
    }
    try {
      const canonicalUrl = canonicalizeUrl(item.url);
      const normalizedContent = `${item.title}\n${item.author ?? ""}\n${item.body ?? item.excerpt ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
      const { data, error } = await getSupabaseAdmin().rpc("ingest_crawl_item", {
        p_rule_id: item.ruleId,
        p_source: item.source,
        p_external_id: item.externalId ?? null,
        p_original_url: item.url,
        p_canonical_url: canonicalUrl,
        p_canonical_url_hash: sha256(canonicalUrl),
        p_content_hash: sha256(normalizedContent),
        p_title: item.title.trim(),
        p_excerpt: item.excerpt ?? null,
        p_body: item.body ?? null,
        p_author: item.author ?? null,
        p_publisher: item.publisher ?? null,
        p_platform: item.platform ?? null,
        p_language: item.language ?? null,
        p_country: item.country ?? null,
        p_location: item.location ?? null,
        p_published_at: item.publishedAt ?? null,
        p_raw_payload: item.rawPayload ?? {},
      });
      results.push(error ? { url: item.url, action: "error", error: error.message } : { url: item.url, ...(data as Record<string, unknown>) });
    } catch (error) {
      results.push({ url: item.url, action: "rejected", error: error instanceof Error ? error.message : "URL tidak valid." });
    }
  }

  const failed = results.filter(result => result.action === "error" || result.action === "rejected").length;
  return NextResponse.json({ accepted: results.length - failed, failed, results }, { status: failed === results.length ? 400 : 200 });
}
