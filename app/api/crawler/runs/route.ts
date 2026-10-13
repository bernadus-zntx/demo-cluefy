import { NextRequest, NextResponse } from "next/server";
import { verifyCrawlerToken } from "../../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

const statuses = ["queued", "running", "completed", "partial", "failed"];

function authorize(request: NextRequest) {
  if (!verifyCrawlerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Crawler credential tidak valid." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });
  return null;
}

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({})) as { rulesRequested?: number; metadata?: Record<string, unknown> };
  const { data, error } = await getSupabaseAdmin().from("crawl_runs").insert({
    status: "running",
    started_at: new Date().toISOString(),
    rules_requested: Math.max(0, Number(body.rulesRequested ?? 0)),
    metadata: body.metadata ?? {},
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await request.json() as Record<string, unknown>;
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!id || !statuses.includes(status)) return NextResponse.json({ error: "Run ID atau status tidak valid." }, { status: 400 });

  const updates = {
    status,
    completed_at: ["completed", "partial", "failed"].includes(status) ? new Date().toISOString() : null,
    items_received: Math.max(0, Number(body.itemsReceived ?? 0)),
    items_inserted: Math.max(0, Number(body.itemsInserted ?? 0)),
    items_duplicate: Math.max(0, Number(body.itemsDuplicate ?? 0)),
    items_revised: Math.max(0, Number(body.itemsRevised ?? 0)),
    error_message: body.errorMessage ? String(body.errorMessage) : null,
  };
  const { data, error } = await getSupabaseAdmin().from("crawl_runs").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data });
}
