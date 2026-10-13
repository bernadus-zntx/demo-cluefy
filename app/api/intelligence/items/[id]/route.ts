import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../../lib/supabase-admin";

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
  const { id } = await params;
  const { error } = await getSupabaseAdmin().from("crawl_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
