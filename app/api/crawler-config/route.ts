import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { fromDbRule, toDbRule, validateRule, type CrawlerRuleDto } from "../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function unavailable() {
  return NextResponse.json({ configured: false, rules: [], message: "Supabase belum terhubung." });
}

export async function GET() {
  if (!isSupabaseConfigured()) return unavailable();
  const { data, error } = await getSupabaseAdmin().from("crawler_rules").select("*").order("code");
  if (error) return NextResponse.json({ configured: true, error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, rules: (data ?? []).map(row => fromDbRule(row)) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const input = await request.json() as Partial<CrawlerRuleDto>;
  const validationError = validateRule(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const code = `CRW-${randomUUID().slice(0, 6).toUpperCase()}`;
  const { data, error } = await supabase.from("crawler_rules").insert({ code, ...toDbRule(input) }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ rule: fromDbRule(data) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const input = await request.json() as Partial<CrawlerRuleDto> & { id?: string };
  if (!input.id) return NextResponse.json({ error: "Rule ID wajib diisi." }, { status: 400 });
  const validationError = validateRule(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("crawler_rules").update(toDbRule(input)).eq("id", input.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ rule: fromDbRule(data) });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule ID wajib diisi." }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("crawler_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ deleted: true });
}
