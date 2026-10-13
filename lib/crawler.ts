import { createHash, timingSafeEqual } from "node:crypto";

export const ruleTypes = ["URL", "Keyword", "Hashtag", "Penulis", "Akun Social", "Group Social"] as const;
export type RuleType = (typeof ruleTypes)[number];
export type RuleStatus = "Aktif" | "Dijeda";

export type CrawlerRuleDto = {
  id: string;
  code: string;
  type: RuleType;
  value: string;
  source: string;
  scope: string;
  intervalMinutes: number;
  lastRun: string | null;
  results: number;
  status: RuleStatus;
  note: string;
  updatedAt: string;
};

const dbTypeByUi: Record<RuleType, string> = {
  URL: "url",
  Keyword: "keyword",
  Hashtag: "hashtag",
  Penulis: "author",
  "Akun Social": "social_account",
  "Group Social": "social_group",
};

const uiTypeByDb = Object.fromEntries(Object.entries(dbTypeByUi).map(([key, value]) => [value, key])) as Record<string, RuleType>;

export function toDbRule(input: Partial<CrawlerRuleDto>) {
  return {
    rule_type: input.type ? dbTypeByUi[input.type] : undefined,
    value: input.value?.trim(),
    source: input.source?.trim(),
    scope: input.scope?.trim(),
    interval_minutes: input.intervalMinutes,
    note: input.note?.trim() || "",
    status: input.status === "Dijeda" ? "paused" : "active",
    updated_at: new Date().toISOString(),
  };
}

export function fromDbRule(row: Record<string, unknown>): CrawlerRuleDto {
  return {
    id: String(row.id),
    code: String(row.code),
    type: uiTypeByDb[String(row.rule_type)] ?? "Keyword",
    value: String(row.value),
    source: String(row.source),
    scope: String(row.scope),
    intervalMinutes: Number(row.interval_minutes),
    lastRun: row.last_run_at ? String(row.last_run_at) : null,
    results: Number(row.result_count ?? 0),
    status: row.status === "paused" ? "Dijeda" : "Aktif",
    note: String(row.note ?? ""),
    updatedAt: String(row.updated_at),
  };
}

export function validateRule(input: Partial<CrawlerRuleDto>) {
  if (!input.type || !ruleTypes.includes(input.type)) return "Tipe konfigurasi tidak valid.";
  if (!input.value?.trim()) return "Target monitoring wajib diisi.";
  if (!input.source?.trim()) return "Sumber atau platform wajib diisi.";
  if (!input.scope?.trim()) return "Cakupan wajib diisi.";
  if (!Number.isInteger(input.intervalMinutes) || Number(input.intervalMinutes) < 5) return "Interval minimum adalah 5 menit.";
  return null;
}

export function canonicalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyCrawlerToken(header: string | null) {
  const expected = process.env.CRAWLER_API_KEY;
  const provided = header?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
