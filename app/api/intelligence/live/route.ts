import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type CrawlRow = {
  id: string;
  source: string;
  external_id: string | null;
  original_url: string;
  canonical_url: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  author: string | null;
  publisher: string | null;
  platform: string | null;
  language: string | null;
  country: string | null;
  location: string | null;
  published_at: string | null;
  captured_at: string;
  first_seen_at: string;
  last_seen_at: string;
  raw_payload: Record<string, unknown> | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRelevantItem(row: CrawlRow) {
  if (row.platform !== "Media Asing") return true;
  const content = `${row.title} ${row.excerpt ?? ""} ${row.body ?? ""}`;
  return /badung|kuta|canggu|seminyak|nusa dua|tanjung benoa|uluwatu|jimbaran|legian|kerobokan|bali|バリ|クタ|チャングー|バドゥン/i.test(content);
}

function itemFromRow(row: CrawlRow) {
  const raw = row.raw_payload ?? {};
  const ai = typeof raw.ai === "object" && raw.ai ? raw.ai as Record<string, unknown> : {};
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    url: row.original_url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    author: row.author,
    publisher: row.publisher,
    platform: row.platform,
    language: row.language,
    country: row.country,
    location: row.location,
    publishedAt: row.published_at,
    capturedAt: row.captured_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    topic: text(raw.topic),
    sentiment: text(raw.sentiment),
    severity: text(raw.severity),
    village: text(raw.village),
    actor: text(raw.actor),
    translation: text(raw.translation),
    validationStatus: text(raw.validationStatus) ?? "unreviewed",
    validatedBy: text(raw.validatedBy),
    validatedAt: text(raw.validatedAt),
    classificationHistory: Array.isArray(raw.classificationHistory) ? raw.classificationHistory : [],
    sourceGroup: text(raw.sourceGroup),
    evidenceType: text(raw.evidenceType),
    sourceNote: text(raw.sourceNote),
    reach: typeof raw.reach === "number" ? raw.reach : null,
    engagement: typeof raw.engagement === "number" ? raw.engagement : null,
    ai: {
      summary: text(ai.summary),
      recommendation: text(ai.recommendation),
      emotion: text(ai.emotion),
      confidence: typeof ai.confidence === "number" ? ai.confidence : null,
      entities: Array.isArray(ai.entities) ? ai.entities.filter(value => typeof value === "string") : [],
    },
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, items: [], rules: [], runs: [], generatedAt: new Date().toISOString() });
  }

  const supabase = getSupabaseAdmin();
  const [itemsResult, rulesResult, runsResult] = await Promise.all([
    supabase.from("crawl_items").select("id,source,external_id,original_url,canonical_url,title,excerpt,body,author,publisher,platform,language,country,location,published_at,captured_at,first_seen_at,last_seen_at,raw_payload").order("published_at", { ascending: false, nullsFirst: false }).limit(1000),
    supabase.from("crawler_rules").select("id,code,rule_type,value,source,scope,status,last_run_at,result_count,updated_at").order("code"),
    supabase.from("crawl_runs").select("id,status,started_at,completed_at,rules_requested,items_received,items_inserted,items_duplicate,items_revised,error_message,created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const error = itemsResult.error ?? rulesResult.error ?? runsResult.error;
  if (error) return NextResponse.json({ configured: true, error: error.message }, { status: 500 });

  return NextResponse.json({
    configured: true,
    generatedAt: new Date().toISOString(),
    items: (itemsResult.data ?? []).filter(row => isRelevantItem(row as CrawlRow)).map(row => itemFromRow(row as CrawlRow)),
    rules: rulesResult.data ?? [],
    runs: runsResult.data ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
