import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";
import { readAllPages } from "../../../../lib/paginated-query";
import { parsePublicComments } from "../../../../lib/comment-analysis";

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

function publisherKey(value: string | null) {
  return value?.normalize("NFKC").trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ") ?? "";
}

function isIndonesianLanguage(value: string | null) {
  return /^(id|id-id|indonesian|bahasa indonesia)$/i.test(value?.trim() ?? "");
}

function isRelevantItem(row: CrawlRow) {
  if (row.platform !== "Media Asing") return true;
  const content = `${row.title} ${row.excerpt ?? ""} ${row.body ?? ""}`;
  return /badung|kuta|canggu|seminyak|nusa dua|tanjung benoa|uluwatu|jimbaran|legian|kerobokan|bali|バリ|クタ|チャングー|バドゥン|бали|балі|кута|чангу|бадунг|семиньяк|нуса-дуа/i.test(content);
}

function itemFromRow(row: CrawlRow, partnerPublishers: Set<string>) {
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
    translation: isIndonesianLanguage(row.language) ? null : text(raw.translation),
    validationStatus: text(raw.validationStatus) ?? "unreviewed",
    validatedBy: text(raw.validatedBy),
    validatedAt: text(raw.validatedAt),
    comments: parsePublicComments(raw.comments),
    viewedAt: text(raw.viewedAt),
    classificationHistory: Array.isArray(raw.classificationHistory) ? raw.classificationHistory : [],
    sourceGroup: text(raw.sourceGroup),
    evidenceType: text(raw.evidenceType),
    sourceNote: text(raw.sourceNote),
    reach: typeof raw.reach === "number" ? raw.reach : null,
    engagement: typeof raw.engagement === "number" ? raw.engagement : null,
    mediaPartner: partnerPublishers.has(publisherKey(row.publisher ?? row.source)),
    ai: {
      summary: text(ai.summary),
      finding: text(ai.finding),
      recommendation: text(ai.recommendation),
      emotion: text(ai.emotion),
      confidence: typeof ai.confidence === "number" ? ai.confidence : null,
      entities: Array.isArray(ai.entities) ? ai.entities.filter(value => typeof value === "string") : [],
      provider: text(ai.provider),
      model: text(ai.model),
      enrichedAt: text(ai.enrichedAt),
    },
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("clock") === "1") return NextResponse.json({ snapshot: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, items: [], rules: [], runs: [], generatedAt: new Date().toISOString() });
  }

  const cursor = params.get("cursor");
  const shard = params.get("shard");
  const overview = params.get("overview") === "1" && shard !== null;
  const snapshot = params.get("snapshot") || new Date().toISOString();
  if ((cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor)) || (shard !== null && !/^[0-3]$/.test(shard)) || !Number.isFinite(Date.parse(snapshot))) {
    return NextResponse.json({ error: "Cursor atau waktu snapshot tidak valid." }, { status: 400 });
  }
  const pageSize = shard === null ? 250 : overview ? 900 : 400;
  const supabase = getSupabaseAdmin();
  let itemsQuery = supabase.from("crawl_items").select("id,source,external_id,original_url,canonical_url,title,excerpt,body,author,publisher,platform,language,country,location,published_at,captured_at,first_seen_at,last_seen_at,raw_payload").lte("first_seen_at", snapshot).order("id", { ascending: false }).limit(pageSize + 1);
  if (shard !== null) {
    const boundaries = ['0', '4', '8', 'c'];
    const index = Number(shard);
    itemsQuery = itemsQuery.gte("id", `${boundaries[index]}0000000-0000-0000-0000-000000000000`);
    if (index < 3) itemsQuery = itemsQuery.lt("id", `${boundaries[index + 1]}0000000-0000-0000-0000-000000000000`);
  }
  if (cursor) itemsQuery = itemsQuery.lt("id", cursor);
  const includeMetadata = !overview && !cursor && (shard === null || shard === '0');
  const [itemsResult, rulesResult, runsResult, partnersResult] = await Promise.all([
    itemsQuery,
    includeMetadata ? readAllPages((from, to) => supabase.from("crawler_rules").select("id,code,rule_type,value,source,scope,status,last_run_at,result_count,updated_at").order("code").range(from, to)) : Promise.resolve({ data: [], error: null }),
    includeMetadata ? supabase.from("crawl_runs").select("id,status,started_at,completed_at,rules_requested,items_received,items_inserted,items_duplicate,items_revised,error_message,created_at").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    overview ? Promise.resolve({ data: [], error: null }) : readAllPages<{ publisher: string | null; source: string }>((from, to) => supabase.from("crawl_items").select("publisher,source").eq("raw_payload->>mediaPartner", "true").order("id").range(from, to)),
  ]);

  const error = itemsResult.error ?? rulesResult.error ?? runsResult.error ?? partnersResult.error;
  if (error) return NextResponse.json({ configured: true, error: error.message }, { status: 500 });

  const rows = (itemsResult.data ?? []).slice(0, pageSize) as CrawlRow[];
  const relevantRows = rows.filter(isRelevantItem);
  const partnerPublishers = new Set((partnersResult.data ?? []).map(row => publisherKey(row.publisher ?? row.source)).filter(Boolean));

  return NextResponse.json({
    configured: true,
    generatedAt: snapshot,
    pagination: { nextCursor: (itemsResult.data?.length ?? 0) > pageSize ? rows.at(-1)!.id : null, snapshot },
    items: relevantRows.map(row => {
      const item = itemFromRow(row, partnerPublishers);
      return overview ? { ...item, url: item.canonicalUrl || item.url, canonicalUrl: null, externalId: null, comments: null, body: null, excerpt: null, translation: null, sourceNote: null, actor: null, classificationHistory: [], ai: { summary: null, finding: null, recommendation: null, emotion: null, confidence: null, entities: [], provider: null, model: null, enrichedAt: null } } : item;
    }),
    rules: rulesResult.data ?? [],
    runs: runsResult.data ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
