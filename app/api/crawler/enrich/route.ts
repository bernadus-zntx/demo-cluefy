import { NextRequest, NextResponse } from "next/server";
import { verifyCrawlerToken } from "../../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

type TranslationEnrichment = {
  id: string;
  translation: string;
  provider?: string;
};

export async function POST(request: NextRequest) {
  if (!verifyCrawlerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Crawler credential tidak valid." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });

  const payload = await request.json() as { items?: TranslationEnrichment[] };
  const items = (payload.items ?? []).filter(item => item.id && item.translation?.trim()).slice(0, 100);
  if (!items.length) return NextResponse.json({ error: "Enrichment terjemahan tidak tersedia." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const ids = Array.from(new Set(items.map(item => item.id)));
  const { data: rows, error: selectError } = await supabase.from("crawl_items").select("id,raw_payload").in("id", ids);
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const byId = new Map(items.map(item => [item.id, item]));
  const updates = await Promise.all((rows ?? []).map(async row => {
    const enrichment = byId.get(String(row.id));
    if (!enrichment) return { id: row.id, updated: false };
    const raw = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
    const { error } = await supabase.from("crawl_items").update({
      raw_payload: {
        ...raw,
        translation: enrichment.translation.trim(),
        translationProvider: enrichment.provider || "Automated translation demo",
        translatedAt: new Date().toISOString(),
      },
    }).eq("id", row.id);
    return { id: row.id, updated: !error, error: error?.message };
  }));

  const failed = updates.filter(result => !result.updated);
  return NextResponse.json({ updated: updates.length - failed.length, failed }, { status: failed.length === updates.length ? 500 : 200 });
}
