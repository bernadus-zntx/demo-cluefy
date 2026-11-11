import { configuration, createDatabase } from './database.mjs';
let database;
try {
  const config = configuration();
  if (!config) throw Error('Not configured');
  database = await createDatabase(config);
  const rows = await database.readArticles();
  console.log(`PASS: dedicated role, effective privileges, RLS and SELECT checked; ${rows.length} articles readable (max 100).`);
} catch {
  console.error('FAIL: check SALES_DATABASE_URL, verified TLS/CA, role grants, RLS and SQL audit. No credentials or raw database errors are logged.');
  process.exitCode = 1;
} finally { await database?.close(); }
