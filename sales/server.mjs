import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function configuration(env = process.env) {
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRAWLER_API_KEY', 'OPENAI_API_KEY']) {
    if (env[name]) throw new Error(`Sales menolak ${name}.`);
  }
  const key = env.SALES_SUPABASE_KEY;
  const base = env.SALES_SUPABASE_URL;
  if (!key && !base) return null;
  if (!key || !base) throw new Error('URL dan publishable/anon key harus diisi bersama.');
  const url = new URL(base);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Sales hanya menerima origin Supabase hosted HTTPS.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* reject below */ }
    if (key.split('.').length !== 3 || role !== 'anon') throw new Error('Hanya publishable atau legacy anon key diperbolehkan.');
  }
  return { url: url.origin, key };
}

const fields = ['id', 'title', 'excerpt', 'publisher', 'platform', 'location', 'published_at'];
export function createSalesServer({ config = configuration(), fetcher = fetch, authenticate = async () => null } = {}) {
  // Production adapter must reuse the existing verified session and its user JWT.
  // No adapter is installed until app.cluefy.co's auth contract is available.
  async function load(principal) {
    const url = new URL('/rest/v1/crawl_items', config.url);
    url.search = new URLSearchParams({ select: fields.join(','), order: 'published_at.desc.nullslast,id.desc', limit: '100' }).toString();
    const response = await fetcher(url, {
      method: 'GET',
      headers: { apikey: config.key, Authorization: `Bearer ${principal.accessToken}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Upstream denied');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid response');
    const items = rows.slice(0, 100).map(row => Object.fromEntries(fields.map(field => [field, typeof row[field] === 'string' ? row[field].slice(0, 4000) : null])));
    return { items, fetchedAt: new Date().toISOString(), message: items.length ? '' : 'Tidak ada baris yang dapat dibaca. Data mungkin kosong atau dibatasi RLS; akses live belum terverifikasi.' };
  }
  return http.createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Sales hanya mendukung GET.' }); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') return send(200, { status: 'ok', mode: 'read-only', configured: Boolean(config) });
    if (url.pathname === '/api/items') {
    let principal;
    try { principal = await authenticate(req); } catch { return send(503, { error: 'Verifikasi session existing tidak tersedia.' }); }
    if (!principal) return send(401, { error: 'Session app.cluefy.co yang terverifikasi diperlukan. Integrasi authentication belum tersedia.' });
    if (principal.internalZntx !== true || !principal.userId || !principal.accessToken) return send(403, { error: 'Akses khusus internal ZNTX.' });
    // Defense in depth only: signature, issuer, expiry and membership must be
    // verified by the existing auth adapter; this check never authenticates JWTs.
    let claims;
    try { claims = JSON.parse(Buffer.from(principal.accessToken.split('.')[1], 'base64url').toString()); } catch { /* deny below */ }
    if (!claims || claims.role !== 'authenticated' || claims.sub !== principal.userId || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) return send(403, { error: 'Token pengguna tidak valid untuk akses Sales.' });
      if (url.search) return send(400, { error: 'Parameter tidak didukung.' });
      if (!config) return send(503, { error: 'Koneksi live belum dikonfigurasi. Menunggu persetujuan.' });
      try { return send(200, await load(principal)); } catch { return send(502, { error: 'Data live tidak dapat dibaca. Periksa izin baca yang sudah ada dan konektivitas; jangan gunakan key admin.' }); }
    }
    const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const asset = assets[url.pathname];
    if (!asset) return send(404, { error: 'Tidak ditemukan.' });
    try { send(200, await readFile(new URL(`./public/${asset[0]}`, import.meta.url), 'utf8'), asset[1]); } catch { send(500, { error: 'Halaman tidak tersedia.' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSalesServer().listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
}
