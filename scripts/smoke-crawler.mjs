import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    result[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = readEnv(new URL("../.env.local", import.meta.url));
const baseUrl = process.argv[2] ?? "http://localhost:3107";
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
assert(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL belum diisi.");
assert(serviceKey, "Supabase secret/service role key belum diisi.");
assert(env.CRAWLER_API_KEY, "CRAWLER_API_KEY belum diisi.");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authorization = { Authorization: `Bearer ${env.CRAWLER_API_KEY}` };
const timestamp = Date.now();
let ruleId;
let runId;
let itemId;
let failure;

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} gagal (${response.status}): ${body.error ?? "unknown error"}`);
  }
  return { response, body };
}

try {
  const config = await request("/api/crawler-config");
  assert(config.body.configured === true, "Dashboard belum membaca konfigurasi Supabase.");
  assert(Array.isArray(config.body.rules), "Daftar konfigurasi crawler tidak valid.");

  const crawlerRules = await request("/api/crawler/rules", { headers: authorization });
  assert(Array.isArray(crawlerRules.body.rules), "Endpoint crawler tidak mengembalikan rules.");

  const created = await request("/api/crawler-config", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      type: "Keyword",
      value: `__CLUEFY_SMOKE_${timestamp}__`,
      source: "Integration Test",
      scope: "Badung · Indonesia",
      intervalMinutes: 10,
      note: "Temporary end-to-end verification rule",
      status: "Aktif",
    }),
  });
  ruleId = created.body.rule?.id;
  assert(ruleId, "Rule uji tidak memiliki ID.");

  const updated = await request("/api/crawler-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ ...created.body.rule, status: "Dijeda", note: "Temporary rule updated successfully" }),
  });
  assert(updated.body.rule?.status === "Dijeda", "Update rule tidak tersimpan.");

  const run = await request("/api/crawler/runs", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ rulesRequested: 1, metadata: { test: true } }),
  });
  runId = run.body.run?.id;
  assert(runId, "Crawl run uji tidak memiliki ID.");

  const url = `https://example.invalid/cluefy-smoke-${timestamp}?utm_source=test`;
  const baseItem = {
    ruleId,
    source: "Integration Test",
    externalId: `smoke-${timestamp}`,
    url,
    title: "Cluefy crawler smoke test",
    body: "Konten awal untuk menguji deduplikasi.",
    author: "Cluefy Test",
    publisher: "Cluefy",
    platform: "web",
    language: "id",
    country: "Indonesia",
    location: "Badung",
  };

  const inserted = await request("/api/crawler/ingest", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(baseItem),
  });
  assert(inserted.body.results?.[0]?.action === "inserted", "Item pertama tidak ditandai inserted.");
  itemId = inserted.body.results[0].item_id;

  const duplicate = await request("/api/crawler/ingest", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(baseItem),
  });
  assert(duplicate.body.results?.[0]?.action === "duplicate", "Item identik tidak ditandai duplicate.");

  const revised = await request("/api/crawler/ingest", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ ...baseItem, body: "Konten diperbarui untuk menguji pencatatan revisi." }),
  });
  assert(revised.body.results?.[0]?.action === "revised", "Perubahan konten tidak ditandai revised.");

  await request("/api/crawler/runs", {
    method: "PATCH",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: runId,
      status: "completed",
      itemsReceived: 3,
      itemsInserted: 1,
      itemsDuplicate: 1,
      itemsRevised: 1,
    }),
  });

  console.log(JSON.stringify({
    connected: true,
    dashboardRules: config.body.rules.length,
    activeCrawlerRules: crawlerRules.body.rules.length,
    ruleCrud: "passed",
    crawlRun: "passed",
    ingestion: ["inserted", "duplicate", "revised"],
  }, null, 2));
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  if (itemId) {
    const { error } = await supabase.from("crawl_items").delete().eq("id", itemId);
    if (error) cleanupErrors.push(`crawl_items: ${error.message}`);
  }
  if (runId) {
    const { error } = await supabase.from("crawl_runs").delete().eq("id", runId);
    if (error) cleanupErrors.push(`crawl_runs: ${error.message}`);
  }
  if (ruleId) {
    const { error } = await supabase.from("crawler_rules").delete().eq("id", ruleId);
    if (error) cleanupErrors.push(`crawler_rules: ${error.message}`);
  }
  if (cleanupErrors.length) {
    const cleanupFailure = new Error(`Cleanup data uji gagal: ${cleanupErrors.join("; ")}`);
    failure = failure ? new AggregateError([failure, cleanupFailure], "Tes dan cleanup sama-sama gagal.") : cleanupFailure;
  }
}

if (failure) throw failure;
