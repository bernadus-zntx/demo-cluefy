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
      const db = getSupabaseAdmin();
      const { data: blocked, error: blockError } = await db.from("crawler_rules").select("code").eq("code", `INVALID-${sha256(canonicalUrl)}`).maybeSingle();
      if (blockError) throw new Error("Filter validasi tidak dapat diperiksa; data tidak disimpan.");
      if (blocked) { results.push({ url: item.url, action: "filtered", reason: "Ditandai tidak valid" }); continue; }
      const { data: existing, error: existingError } = await db.from("crawl_items").select("raw_payload").eq("canonical_url_hash", sha256(canonicalUrl)).maybeSingle();
      if (existingError) throw new Error("Status validasi tidak dapat diperiksa; data tidak disimpan.");
      const previous = existing?.raw_payload && typeof existing.raw_payload === "object" ? existing.raw_payload as Record<string, unknown> : {};
      const reviewed = Object.fromEntries(["viewedAt", "validationStatus", "validatedBy", "validatedAt"].filter(key => previous[key] != null).map(key => [key, previous[key]]));
      const normalizedContent = `${item.title}\n${item.author ?? ""}\n${item.body ?? item.excerpt ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
      const { data, error } = await db.rpc("ingest_crawl_item", {
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
        p_raw_payload: { ...(item.rawPayload ?? {}), ...reviewed },
      });
      if (!error && data && typeof data === "object" && "item_id" in data) {
        const { data: blockedAfter, error: recheckError } = await db.from("crawler_rules").select("code").eq("code", `INVALID-${sha256(canonicalUrl)}`).maybeSingle();
        if (recheckError) throw new Error("Filter validasi gagal diperiksa ulang.");
        if (blockedAfter) {
          const { error: deleteError } = await db.from("crawl_items").delete().eq("id", data.item_id);
          if (deleteError) throw new Error("Data tidak valid gagal dikeluarkan.");
          results.push({ url: item.url, action: "filtered", reason: "Ditandai tidak valid" });
          continue;
        }
      }
      results.push(error ? { url: item.url, action: "error", error: error.message } : { url: item.url, ...(data as Record<string, unknown>) });
    } catch (error) {
      results.push({ url: item.url, action: "rejected", error: error instanceof Error ? error.message : "URL tidak valid." });
    }
  }

  const failed = results.filter(result => result.action === "error" || result.action === "rejected").length;
  const filtered = results.filter(result => result.action === "filtered").length;
  return NextResponse.json({ accepted: results.length - failed - filtered, filtered, failed, results }, { status: failed === results.length ? 400 : 200 });
}
