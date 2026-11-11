# ClueFy Sales — dashboard existing, Supabase read-only

Sales membundel langsung `app/page.tsx`, seluruh komponen `app/intelligence/`, Ara Assistant, CSS dan aset `public/` dari repo demo-cluefy. Tidak ada dashboard pengganti. Login organization/role/email/password tetap simulasi dalam React; `/` dan `/sales` membuka aplikasi yang sama. Login bukan autentikasi atau batas akses backend.

Build Vite khusus Sales mengganti provider LiveIntelligence dengan adapter `sales/ui/LiveIntelligence.tsx`. Adapter membaca hanya `GET /api/items`, mengubah tujuh kolom ke struktur yang dibutuhkan UI existing, dan refresh tiap 60 detik. Tidak memakai Next API routes, crawler, service_role atau SDK Supabase di runtime. Enrichment otomatis dimatikan untuk build Sales. Cases/Findings dan workspace demo existing tetap simulasi lokal; aksi yang membutuhkan backend tulis ditolak 405 dan tidak tersimpan ke production. Banner menjelaskan batas ini di semua halaman.

## Batas data

Maksimum 100 artikel terbaru: id, title, excerpt, publisher, platform, location, published_at. Search/filter/angka dashboard berlaku hanya pada snapshot ini, bukan seluruh database. URL sumber, full body, sentiment, klasifikasi, AI, reach, engagement, komentar, crawler rules/runs dan media partner tidak diizinkan oleh reader saat ini; adapter tidak mengarang nilainya. Gunakan filter periode **All time** jika artikel terbaru berada di luar periode default dashboard. Workspace government memakai data live; workspace beauty/validation mempertahankan simulasi existing.

Backend `database.mjs` dan SQL reader tidak berubah: verified TLS, pool 2 koneksi, transaksi READ ONLY, audit effective privileges/RLS setiap baca, fixed SELECT LIMIT 100, sanitasi error, tidak ada SQL dinamis. `/healthz` hanya memeriksa proses/config; `check:database` membuktikan koneksi dan izin baca. Database failure menghasilkan 502, belum dikonfigurasi 503, tanpa fallback dummy.

## Build dan verifikasi lokal

Dari root repo (Node >=22.13):

```sh
npm ci --prefix sales --ignore-scripts
npm test --prefix sales
node --check sales/server.mjs
node --check sales/database.mjs
docker compose -f sales/compose.yaml config --quiet
docker build -f sales/Dockerfile -t cluefy-sales:review .
```

Build context sekarang **root repo**, karena dashboard ada di `app/`, `lib/`, dan `public/`. Compose mengatur context ini otomatis. Jangan gunakan `docker build sales` atau menyalin hanya folder sales. Multi-stage Docker mengompilasi UI lalu menyalin hanya dist dan dependency pg ke image runtime, tanpa source Next API atau secrets. Frontend hasil build ada di `sales/dist/` (diabaikan Git). `sync-existing-login.mjs` dan `sales/public/` adalah artefak frontend lama, tidak dipakai build/runtime baru.

Tes menjalankan build dashboard dan HTTP loopback dengan database tiruan: pembatasan metode, tujuh kolom, limit, sanitasi, TLS, audit role, rollback, aset bundle, traversal path dan logo. Tidak menyentuh database production.

## Update deployment Debian yang sudah berjalan

Sediakan perubahan repo ini di `/home/user104/cluefy/cluefy-sales`, pertahankan `sales/.env` dan folder `sales/certs` yang sudah bekerja. Tidak perlu menjalankan ulang SQL provisioning reader yang sudah PASS.

```sh
cd /home/user104/cluefy/cluefy-sales/sales
docker compose --env-file .env config --quiet
docker compose --env-file .env build sales
docker compose --env-file .env up -d --no-deps sales
docker compose --env-file .env exec -T sales node check-database.mjs
docker compose --env-file .env ps
curl --fail http://127.0.0.1:3117/healthz
curl --fail --silent http://127.0.0.1:3117/sales > /dev/null
```

Buka melalui SSH tunnel port 3117 lalu login simulasi, pilih Kabupaten Badung, periksa Overview dan Conversations/Aspirasi Warga. Pastikan artikel live tampil, filter berfungsi, navigasi tidak blank dan refresh tetap membaca data. Tanpa credentials, login/navigasi tetap terbuka dan panel live menunjukkan error konfigurasi.

Compose mempertahankan project `cluefy-sales`, service/image, `127.0.0.1:3117:3000`, user non-root, filesystem read-only, cert mount read-only, healthcheck dan semua resource/security limits. Tidak membuat database/crawler/network external atau mengubah iCentra. Jangan jalankan root compose, prune, atau down project lain. Jangan mencetak hasil compose config tanpa `--quiet` karena memuat password.

Untuk rollback, simpan tag image lama sebelum build (`docker image tag cluefy-sales:review cluefy-sales:previous`). Jika diperlukan, tag kembali previous sebagai review lalu jalankan `docker compose --env-file .env up -d --no-deps --force-recreate sales` tanpa build. Ini hanya mengganti Sales.

## Konfigurasi database MANUAL — belum dijalankan

Tidak ada SQL di sini yang diterapkan otomatis oleh app, Docker, CI, atau migration existing. Review dan persetujuan pemilik production diperlukan sebelum langkah yang mengubah database.

1. Review `sql/01-create-reader.sql`: membuat role baru tanpa hak admin/BYPASSRLS atau membership; grant CONNECT + schema USAGE + SELECT tujuh kolom saja; default read-only dan timeout; policy `FOR SELECT TO cluefy_sales_reader USING (true)` pada crawl_items. Ini memberi internal Sales akses seluruh baris pada tabel tersebut melalui kolom yang diizinkan. Tidak mengubah policy/role/grant anon, authenticated, atau service_role. RLS existing wajib sudah aktif. Script fail pada rerun; jangan drop existing role/policy tanpa review.
2. Setelah disetujui, administrator menjalankan script tersebut melalui Supabase SQL Editor atau psql admin. Script tidak memiliki password. Set password role secara interaktif dengan psql `\password cluefy_sales_reader` menggunakan koneksi admin verified TLS; jangan menyimpan password di SQL/repo/chat/log.
3. Administrator menjalankan `sql/02-audit-reader.sql` (catalog SELECT saja). Role flags harus non-admin, membership kosong, hak tulis/CREATE/sequence kosong, executable SECURITY DEFINER kosong, dan hanya tujuh kolom artikel yang diberikan script yang readable kecuali ada grants SELECT existing yang sudah direview. Pastikan policy baru hanya role reader; restrictive policies existing dapat tetap membatasi baris.
4. Bila ada hak berbahaya dari PUBLIC, **STOP**, jangan otomatis REVOKE PUBLIC atau mengubah shared roles. DBA harus mereview sumber privilege dan dampak perubahan terhadap deployment existing. App sengaja menolak konfigurasi seperti itu. Pemberian SELECT saja tidak menghilangkan hak bawaan PUBLIC. Fungsi definer yang terlihat read-only juga tidak di-allowlist otomatis.
5. Ambil host production dari Supabase Dashboard **Connect**. Direct: username `cluefy_sales_reader`, host `db.<projectref>.supabase.co:5432`; jika Debian membutuhkan IPv4, gunakan **session pooler** host dari Dashboard dengan username `cluefy_sales_reader.<projectref>` (biasanya port 5432). Dukungan custom role pada pooler perlu diperiksa pada project. Transaction pooler 6543 juga didukung oleh app (tanpa prepared statements/session state di luar transaksi), tetapi session pooler adalah pilihan awal untuk container persisten ini.
6. Buat file `/opt/cluefy-sales/.env.sales`, izin 600, berdasarkan `.env.example`. Isi `SALES_DATABASE_URL` dengan URL postgres role reader, password di-percent-encode. Database harus `postgres`, jangan tambahkan query string `sslmode` atau parameter SSL lain; TLS diatur driver dan tidak boleh dimatikan. Jangan pakai user postgres, credentials existing, publishable key, service_role, atau SUPABASE_SECRET_KEY.
7. Download CA dari Dashboard bila diperlukan untuk certificate chain production, simpan di `sales/certs/prod-ca.crt` (bukan credential), set `SALES_DATABASE_CA_FILE=/app/certs/prod-ca.crt` untuk Docker atau absolute path host untuk proses lokal. Jika CA kosong, Node memakai trust store default; koneksi gagal jika certificate tidak trusted, tanpa fallback insecure. Folder certs di-mount read-only dan tidak masuk image. Jangan menonaktifkan certificate verification.

Dokumentasi resmi: https://supabase.com/docs/guides/database/connecting-to-postgres dan https://supabase.com/docs/guides/platform/ssl-enforcement . Tidak ada query ke production dilakukan dalam development ini.
