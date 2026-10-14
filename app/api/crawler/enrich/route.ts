import { NextRequest, NextResponse } from "next/server";
import { verifyCrawlerToken } from "../../../../lib/crawler";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase-admin";

type AiEnrichment = {
  relevant: boolean;
  relevanceReason: string;
  summary: string;
  finding: string;
  recommendation: string;
  topic: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  emotion: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  location: string;
  village: string;
  actor: string;
  entities: string[];
  confidence: number;
  translation: string;
};

type CrawlEnrichment = {
  id: string;
  translation?: string;
  provider?: string;
  ai?: AiEnrichment;
  model?: string;
};

export async function POST(request: NextRequest) {
  if (!verifyCrawlerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Crawler credential tidak valid." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum terhubung." }, { status: 503 });

  const payload = await request.json() as { items?: CrawlEnrichment[] };
  const items = (payload.items ?? []).filter(item => item.id && (item.translation?.trim() || item.ai)).slice(0, 100);
  if (!items.length) return NextResponse.json({ error: "Enrichment tidak tersedia." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const ids = Array.from(new Set(items.map(item => item.id)));
  const { data: rows, error: selectError } = await supabase.from("crawl_items").select("id,location,raw_payload").in("id", ids);
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const byId = new Map(items.map(item => [item.id, item]));
  const updates = await Promise.all((rows ?? []).map(async row => {
    const enrichment = byId.get(String(row.id));
    if (!enrichment) return { id: row.id, updated: false };
    const raw = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
    const now = new Date().toISOString();
    const wasHumanEdited = Array.isArray(raw.classificationHistory) && raw.classificationHistory.length > 0;
    const nextRaw: Record<string, unknown> = { ...raw };
    if (enrichment.translation?.trim()) {
      nextRaw.translation = enrichment.translation.trim();
      nextRaw.translationProvider = enrichment.provider || "Automated translation";
      nextRaw.translatedAt = now;
    }
    if (enrichment.ai) {
      const ai = enrichment.ai;
      nextRaw.ai = {
        summary: ai.summary.trim(), finding: ai.finding.trim(), recommendation: ai.recommendation.trim(),
        emotion: ai.emotion.trim(), confidence: ai.confidence, entities: ai.entities,
        model: enrichment.model || "gpt-6-luna", provider: "OpenAI", enrichedAt: now,
      };
      nextRaw.aiRelevance = { relevant: ai.relevant, reason: ai.relevanceReason.trim() };
      nextRaw.aiProvider = "OpenAI";
      nextRaw.aiModel = enrichment.model || "gpt-6-luna";
      nextRaw.aiEnrichedAt = now;
      if (!nextRaw.translation && ai.translation.trim()) {
        nextRaw.translation = ai.translation.trim();
        nextRaw.translationProvider = `OpenAI · ${enrichment.model || "gpt-6-luna"}`;
        nextRaw.translatedAt = now;
      }
      if (!wasHumanEdited) {
        nextRaw.topic = ai.topic;
        nextRaw.sentiment = ai.sentiment;
        nextRaw.severity = ai.severity;
        nextRaw.village = ai.village.trim() || null;
        nextRaw.actor = ai.actor.trim() || null;
      }
    }
    const update: Record<string, unknown> = { raw_payload: nextRaw };
    if (enrichment.ai && !wasHumanEdited && enrichment.ai.location.trim()) update.location = enrichment.ai.location.trim();
    const { error } = await supabase.from("crawl_items").update(update).eq("id", row.id);
    return { id: row.id, updated: !error, error: error?.message };
  }));

  const failed = updates.filter(result => !result.updated);
  return NextResponse.json({ updated: updates.length - failed.length, failed }, { status: failed.length === updates.length ? 500 : 200 });
}
