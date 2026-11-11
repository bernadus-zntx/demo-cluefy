import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { configuration, createDatabase } from './database.mjs';
export { configuration } from './database.mjs';

const fields = ['id', 'title', 'excerpt', 'publisher', 'platform', 'location', 'published_at'];
export function createSalesServer({ config = configuration(), database = null } = {}) {
  return http.createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
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
    const assets = { '/sales': ['index.html', 'text/html'], '/existing-login.css': ['existing-login.css', 'text/css'], '/cluefy-icon-exact.png': ['cluefy-icon-exact.png', 'image/png'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const asset = assets[url.pathname];
    if (!asset) return send(404, { error: 'Tidak ditemukan.' });
    try { send(200, await readFile(new URL(`./public/${asset[0]}`, import.meta.url), asset[1].startsWith('image/') ? null : 'utf8'), asset[1]); } catch { send(500, { error: 'Halaman tidak tersedia.' }); }
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
