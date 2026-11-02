import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../../lib/supabase-admin";
import { canonicalizeUrl, sha256 } from "../../../../../lib/crawler";

const editableFields = ["topic", "sentiment", "severity", "actor", "village"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const { id } = await params;
  const payload = await request.json() as Record<string, unknown>;
  const supabase = getSupabaseAdmin();
  const { data: item, error } = await supabase.from("crawl_items").select("id,location,raw_payload").eq("id", id).single();
  if (error || !item) return NextResponse.json({ error: "Data crawler tidak ditemukan." }, { status: 404 });
  const raw = item.raw_payload && typeof item.raw_payload === "object" ? item.raw_payload as Record<string, unknown> : {};
  const nextRaw = { ...raw };
  if (payload.viewed === true && !raw.viewedAt) nextRaw.viewedAt = new Date().toISOString();
  for (const field of editableFields) if (typeof payload[field] === "string") nextRaw[field] = String(payload[field]).trim();
  if (payload.validationStatus === "valid") {
    nextRaw.validationStatus = "valid";
    nextRaw.validatedBy = "Budi Santoso";
    nextRaw.validatedAt = new Date().toISOString();
  }
  if (typeof payload.reason === "string" && payload.reason.trim()) {
    const history = Array.isArray(raw.classificationHistory) ? raw.classificationHistory : [];
    nextRaw.classificationHistory = [...history, { actor: "Budi Santoso", at: new Date().toISOString(), reason: payload.reason.trim(), changes: payload.changes || [] }];
  }
  const updates: Record<string, unknown> = { raw_payload: nextRaw };
  if (typeof payload.location === "string") updates.location = payload.location.trim();
  const { error: updateError } = await supabase.from("crawl_items").update(updates).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ updated: true, validationStatus: nextRaw.validationStatus || "unreviewed" });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (payload.confirm !== "HARD_DELETE") return NextResponse.json({ error: "Konfirmasi hard delete tidak valid." }, { status: 400 });
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!reason || reason.length > 1000) return NextResponse.json({ error: "Alasan tidak valid wajib diisi (maksimal 1000 karakter)." }, { status: 400 });
  const { id } = await params;
  const db = getSupabaseAdmin();
  const { data: item, error: readError } = await db.from("crawl_items").select("canonical_url,original_url").eq("id", id).single();
  if (readError || !item) return NextResponse.json({ error: "Data crawler tidak ditemukan." }, { status: 404 });
  let url: string;
  try { url = canonicalizeUrl(item.canonical_url || item.original_url); } catch { return NextResponse.json({ error: "URL sumber tidak valid; data tidak dihapus." }, { status: 400 }); }
  const code = `INVALID-${sha256(url)}`;
  const { error: ruleError } = await db.from("crawler_rules").upsert({ code, rule_type: "url", value: url, source: "Validasi tidak valid", scope: "Validasi hasil crawling", interval_minutes: 10, status: "paused", note: reason }, { onConflict: "code" });
  if (ruleError) return NextResponse.json({ error: `Alasan gagal disimpan; data tidak dihapus: ${ruleError.message}` }, { status: 500 });
  const { error } = await db.from("crawl_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
