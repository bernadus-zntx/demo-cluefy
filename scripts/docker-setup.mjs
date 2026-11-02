import { createHmac, randomBytes } from "node:crypto";
import { open } from "node:fs/promises";

const path = new URL("../.env.docker", import.meta.url);
const random = bytes => randomBytes(bytes).toString("hex");
const jwtSecret = random(32);
const encoded = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const issuedAt = Math.floor(Date.now() / 1000);
const unsigned = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({
  iss: "cluefy-docker",
  role: "service_role",
  iat: issuedAt,
  exp: issuedAt + 10 * 365 * 24 * 60 * 60,
})}`;
const signature = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
const values = [
  `POSTGRES_PASSWORD=${random(24)}`,
  `PGRST_JWT_SECRET=${jwtSecret}`,
  `SUPABASE_SERVICE_ROLE_KEY=${unsigned}.${signature}`,
  `CRAWLER_API_KEY=${random(32)}`,
  "CLUEFY_PORT=3107",
  "OPENAI_API_KEY=",
  "OPENAI_MODEL=gpt-6-luna",
  "AI_ENRICH_MAX_ITEMS=25",
  "CRAWLER_SINCE=2026-10-01T00:00:00+08:00",
];

try {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(`${values.join("\n")}\n`); }
  finally { await file.close(); }
  console.log(".env.docker dibuat. Simpan file ini hanya di mesin yang menjalankan Docker.");
} catch (error) {
  if (error?.code === "EEXIST") {
    console.log(".env.docker sudah ada; kunci lama tetap dipakai.");
  } else {
    throw error;
  }
}
