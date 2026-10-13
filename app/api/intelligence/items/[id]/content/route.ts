import { NextResponse } from "next/server";
import { fetchArticleContent } from "../../../../../../lib/article-content";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: item, error } = await supabase.from("crawl_items").select("id,original_url,body,raw_payload").eq("id", id).single();
  if (error || !item) return NextResponse.json({ error: "Data crawler tidak ditemukan." }, { status: 404 });
  if (item.body) return NextResponse.json({ content: item.body, publisherUrl: (item.raw_payload as Record<string, unknown> | null)?.publisherUrl || item.original_url, cached: true });

  try {
    const extracted = await fetchArticleContent(item.original_url);
    const raw = item.raw_payload && typeof item.raw_payload === "object" ? item.raw_payload as Record<string, unknown> : {};
    const { error: updateError } = await supabase.from("crawl_items").update({
      body: extracted.content,
      original_url: extracted.publisherUrl,
      raw_payload: { ...raw, publisherUrl: extracted.publisherUrl, contentExtractedAt: new Date().toISOString() },
    }).eq("id", id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ...extracted, cached: false });
  } catch (fetchError) {
    return NextResponse.json({ error: fetchError instanceof Error ? fetchError.message : "Isi artikel tidak dapat diambil." }, { status: 422 });
  }
}
