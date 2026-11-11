import { readFile } from 'node:fs/promises';

export function configuration(env = process.env) {
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SALES_SUPABASE_KEY', 'SALES_SUPABASE_URL', 'CRAWLER_API_KEY', 'OPENAI_API_KEY']) {
    if (env[name]) throw Error(`Sales menolak ${name}; gunakan konfigurasi database Sales.`);
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw Error('Sales memerlukan verified TLS.');
  if (!env.SALES_DATABASE_URL) return null;
  let url;
  try { url = new URL(env.SALES_DATABASE_URL); } catch { throw Error('URL database Sales tidak valid.'); }
  let username;
  try { username = decodeURIComponent(url.username); } catch { throw Error('Username database tidak valid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.password || url.pathname !== '/postgres' || url.search || url.hash || !/^(db\.[a-z0-9]+\.supabase\.co|[a-z0-9.-]+\.pooler\.supabase\.com)$/.test(url.hostname) || !/^cluefy_sales_reader(?:\.[a-z0-9]+)?$/.test(username) || (url.port && !['5432','6543'].includes(url.port))) throw Error('Gunakan URL Supabase hosted untuk cluefy_sales_reader, tanpa parameter URL.');
  return { connectionString: url.toString(), caFile: env.SALES_DATABASE_CA_FILE || null };
}

// Effective privileges include PUBLIC grants. Refuse unsafe existing grants;
// never repair permissions or execute DDL from this application.
export const permissionSql = `
SELECT current_user AS role,
  r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication AS privileged,
  EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid) AS memberships,
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
    AND c.relkind IN ('r','p','v','m','f') AND
    (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
     OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES')
     OR c.relowner=r.oid)) AS writable,
  EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%'
    AND n.nspname <> 'information_schema' AND has_schema_privilege(current_user,n.oid,'CREATE')) AS schema_create,
  has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
    AND p.prosecdef AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS definer_execute,
  EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND has_sequence_privilege(current_user,oid,'USAGE,UPDATE')) AS sequence_write,
  EXISTS (SELECT 1 FROM pg_class WHERE oid='public.crawl_items'::regclass AND relrowsecurity) AS rls_enabled,
  EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.crawl_items'::regclass
    AND polcmd='r' AND r.oid=ANY(polroles)) AS reader_policy,
  has_schema_privilege(current_user,'public','USAGE') AND
    has_column_privilege(current_user,'public.crawl_items','id','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','title','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','excerpt','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','publisher','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','platform','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','location','SELECT') AND
    has_column_privilege(current_user,'public.crawl_items','published_at','SELECT') AS can_read
FROM pg_roles r WHERE rolname=current_user`;
export const articleSql = `SELECT id::text AS id, left(title,4000) AS title, left(excerpt,4000) AS excerpt,
left(publisher,4000) AS publisher, left(platform,4000) AS platform, left(location,4000) AS location,
published_at::text AS published_at FROM public.crawl_items
ORDER BY published_at DESC NULLS LAST, id DESC LIMIT 100`;
export function assertPermissions(row) {
  if (!row || row.role !== 'cluefy_sales_reader' || row.privileged !== false || row.memberships !== false || row.writable !== false || row.schema_create !== false || row.database_create !== false || row.definer_execute !== false || row.sequence_write !== false || row.rls_enabled !== true || row.reader_policy !== true || row.can_read !== true) throw Error('Role Sales belum memenuhi izin SELECT-only/RLS. Jalankan panduan pemeriksaan database.');
}
export async function createDatabase(config, PoolClass) {
  const Pool = PoolClass || (await import('pg')).default.Pool;
  const ca = config.caFile ? await readFile(config.caFile, 'utf8') : undefined;
  const pool = new Pool({ connectionString: config.connectionString,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    query_timeout: 10000, statement_timeout: 8000,
    application_name: 'cluefy-sales-readonly',
  });
  pool.on('error', () => { /* Never log connection strings or PostgreSQL details. */ });
  return {
    async readArticles() {
      if (pool.waitingCount >= 4) throw Error('Sales database busy.');
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN READ ONLY');
        await client.query("SET LOCAL statement_timeout = '8s'");
        const permissions = await client.query(permissionSql);
        assertPermissions(permissions.rows[0]);
        const result = await client.query(articleSql);
        await client.query('COMMIT');
        return result.rows.slice(0, 100);
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
        throw error;
      } finally { client.release(broken); }
    },
    close: () => pool.end(),
  };
}
