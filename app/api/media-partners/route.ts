import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });

  const input = await request.json() as { publisher?: unknown; isPartner?: unknown };
  const publisher = typeof input.publisher === "string" ? input.publisher.trim() : "";
  if (!publisher || typeof input.isPartner !== "boolean") {
    return NextResponse.json({ error: "Nama media dan status partner wajib diisi." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let { data: rows, error: selectError } = await supabase.from("crawl_items").select("id,raw_payload").eq("publisher", publisher);
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  if (!rows?.length) {
    const fallback = await supabase.from("crawl_items").select("id,raw_payload").eq("source", publisher);
    rows = fallback.data;
    selectError = fallback.error;
  }
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ error: "Konten untuk media ini tidak ditemukan." }, { status: 404 });

  const updates = await Promise.all(rows.map(row => {
    const raw = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
    return supabase.from("crawl_items").update({ raw_payload: { ...raw, mediaPartner: input.isPartner } }).eq("id", row.id);
  }));
  const updateError = updates.find(result => result.error)?.error;
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ publisher, isPartner: input.isPartner, updated: rows.length });
}
