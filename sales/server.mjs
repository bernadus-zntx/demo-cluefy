import http from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { configuration, createDatabase } from './database.mjs';
export { configuration } from './database.mjs';

const fields = ['id', 'title', 'excerpt', 'publisher', 'platform', 'location', 'published_at'];
export function createSalesServer({ config = configuration(), database = null } = {}) {
  return http.createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Sales hanya mendukung GET.' }); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') return send(200, { status: 'ok', mode: 'read-only', configured: Boolean(config) });
    if (url.pathname === '/api/items') {
      if (url.search) return send(400, { error: 'Parameter tidak didukung.' });
      if (!config || !database) return send(503, { error: 'Koneksi database read-only belum dikonfigurasi. Ikuti README Sales.' });
      try {
        const rows = await database.readArticles();
        const items = rows.slice(0, 100).map(row => Object.fromEntries(fields.map(field => [field, typeof row[field] === 'string' ? row[field].slice(0, 4000) : null])));
        return send(200, { items, fetchedAt: new Date().toISOString(), message: items.length ? '' : 'Tidak ada artikel yang dapat dibaca pada snapshot ini.' });
      } catch { return send(502, { error: 'Koneksi/izin SELECT-only database belum valid atau query gagal. Periksa konfigurasi dan jalankan check:database.' }); }
    }
    // Serve only the compiled existing dashboard and its public assets.
    const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
    const pathname = ['/', '/sales', '/sales/'].includes(url.pathname) ? '/index.html' : url.pathname;
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return send(400, {error:'Path tidak valid.'}); }
    const filename = resolve(root, `.${decoded}`);
    if (!filename.startsWith(root + sep) || decoded.includes('\\') || decoded.split('/').some(part=>part.startsWith('.'))) return send(404,{error:'Tidak ditemukan.'});
    const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
    const type = types[extname(filename)];
    if (!type) return send(404,{error:'Tidak ditemukan.'});
    try { return send(200, await readFile(filename), type); }
    catch { return send(404, {error:'Tidak ditemukan.'}); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configuration();
  const database = config ? await createDatabase(config) : null;
  const server = createSalesServer({ config, database });
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    server.close(async () => { await database?.close(); process.exit(0); });
  });
}
