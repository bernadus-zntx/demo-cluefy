import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { fromDbRule, verifyCrawlerToken } from "../../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyCrawlerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Crawler credential tidak valid." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });

  const { data, error } = await getSupabaseAdmin().from("crawler_rules").select("*").eq("status", "active").order("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rules = (data ?? []).map(row => fromDbRule(row));
  const etag = `"${createHash("sha1").update(JSON.stringify(rules.map(rule => [rule.id, rule.updatedAt]))).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });

  return NextResponse.json(
    { workspace: "kabupaten-badung", generatedAt: new Date().toISOString(), nextPollAfterSeconds: 600, rules },
    { headers: { "Cache-Control": "private, no-store", ETag: etag } },
  );
}
