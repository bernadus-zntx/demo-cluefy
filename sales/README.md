# ClueFy Sales: live database read-only proxy

Login dan desain existing tetap frontend simulation; submit membuka `/sales`. Organization/Role/Email/Password mengikuti existing. Tidak ada authentication/session baru. Backend mengambil data langsung dari PostgreSQL Supabase production dengan login database khusus `cluefy_sales_reader`, bukan anon/SDK/service_role. Browser hanya menerima JSON tujuh kolom artikel, tidak pernah connection string atau password.

## Arsitektur dan batas

Satu container Node, bind `127.0.0.1:3117`, tanpa crawler/Postgres/PostgREST lokal. Endpoint data satu-satunya `GET /api/items`, query SQL tetap, tanpa query parameters; maksimum 100 artikel terbaru berdasarkan published_at dan id. Kolom: id, title, excerpt, publisher, platform, location, published_at. Search di browser hanya mencakup 100 artikel tersebut. GET static assets dan `/healthz` tidak mengakses database. Semua metode selain GET ditolak 405 dan route crawler/mutasi tidak ada. API sengaja tidak memerlukan session sesuai keputusan user; akses service tetap loopback/internal, jangan publish port atau menambah reverse proxy publik.

Koneksi menggunakan verified TLS (rejectUnauthorized true), pool maksimum 2, timeout koneksi 5 detik/query 8 detik. Setiap request data memakai transaksi `BEGIN READ ONLY`, pemeriksaan role dan effective privileges, kemudian fixed SELECT LIMIT 100. Tidak ada shared cache: refresh membaca snapshot baru production. Kegagalan konfigurasi menghasilkan 503, izin/koneksi/query gagal 502, tanpa detail database/secrets di respons/log. Data kosong berarti tidak ada baris pada snapshot yang dapat dibaca, bukan fallback dummy.

Pemeriksaan menolak role lain, superuser/BYPASSRLS/CREATEROLE/CREATEDB/replication, role membership, hak tulis tabel/kolom, ownership tabel, schema/database CREATE, sequence USAGE/UPDATE, dan EXECUTE fungsi SECURITY DEFINER non-system yang accessible. Ini mencakup grants dari PUBLIC; `NOINHERIT` tidak menghapus grants PUBLIC. Hak baca tujuh kolom, RLS aktif, dan SELECT policy khusus role wajib ada. Audit dijalankan setiap baca agar perubahan privilege berikutnya memblokir aplikasi.

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

## Build dan test tanpa database production

Dari root repository:

```sh
npm ci --prefix sales --ignore-scripts
node sales/sync-existing-login.mjs --check
node --test sales/tests/*.test.mjs
node --check sales/server.mjs
node --check sales/database.mjs
docker compose -f sales/compose.yaml config --quiet
docker build -t cluefy-sales:review sales
```

Tes memakai driver/database tiruan dan HTTP loopback. Menguji config, TLS options, transaksi read-only, audit privileges, rollback/release, batas 100, proyeksi/error sanitization, blokir mutasi/query injection dan reuse assets existing. Tidak menjalankan database/crawler lokal. SQL PostgreSQL belum diuji terhadap server sungguhan; validasi katalog dan koneksi target masih diperlukan. Node lokal 24; CI/container menarget Node 22. Workflow Sales build/test saja, tanpa deploy/secrets; workflow existing tetap ada.

## Validasi koneksi setelah provisioning disetujui

Dengan konfigurasi reader pada mesin yang diizinkan, jalankan dari folder sales:

```sh
node --env-file=/opt/cluefy-sales/.env.sales check-database.mjs
```

Untuk proses lokal, CA_FILE harus path host; path `/app/certs/...` hanya ada dalam container. Checker melakukan catalog SELECT dan query artikel dalam READ ONLY, tidak mencoba INSERT/UPDATE/DELETE atau mengubah grants. Output hanya PASS/FAIL dan jumlah baris; tidak mencetak connection string, data artikel, atau raw errors. PASS dengan 0 baris membuktikan query berhasil tetapi perlu konfirmasi pemilik data tentang isi yang diharapkan. Jika gagal, jalankan audit katalog dengan DBA dan cek TLS/host/user/password/network; jangan downgrade credentials ke admin. Jangan menguji mutasi terhadap production. Pengujian negatif DML/DDL yang benar-benar mengeksekusi statement hanya boleh dilakukan pada environment disposable terpisah yang disetujui, bukan production.

## Debian setelah persetujuan deployment

1. Periksa kapasitas host, layanan/iCentra/ClueFy existing dan port 3117. Tempatkan folder Sales di direktori baru `/opt/cluefy-sales`; jangan overwrite Compose/.env/proxy existing. Jangan ubah project name `cluefy-sales` menjadi project existing.
2. Konfigurasi file env terpisah sesuai petunjuk di atas. Pastikan folder certs ada dan readable oleh user container node. Jalankan `docker compose --env-file /opt/cluefy-sales/.env.sales -f /opt/cluefy-sales/compose.yaml config --quiet`; jangan cetak config karena mengandung database password.
3. Build dan start HANYA Compose Sales setelah approval deployment:

```sh
docker compose --env-file /opt/cluefy-sales/.env.sales -f /opt/cluefy-sales/compose.yaml up --build -d
```

4. Validasi DB melalui container yang sudah berjalan (CA path container):

```sh
docker compose --env-file /opt/cluefy-sales/.env.sales -f /opt/cluefy-sales/compose.yaml exec -T sales node check-database.mjs
curl --fail http://127.0.0.1:3117/healthz
curl --fail http://127.0.0.1:3117/api/items
```

Jangan salin output data artikel ke log publik. `/healthz` hanya proses/config, bukan bukti koneksi database. Buka melalui SSH tunnel; port hanya loopback. Image non-root, filesystem read-only, capabilities dibuang dan resources dibatasi. Tidak ada shared data volumes/network external; hanya CA folder read-only.
5. Periksa health/resources existing sebelum/sesudah. Rollback hanya project Sales dengan file Compose/env Sales dan `down`; jangan `down -v`, prune, atau stop service existing. Untuk menonaktifkan credential reader, DBA dapat `ALTER ROLE cluefy_sales_reader NOLOGIN` setelah review (koneksi aktif perlu ditangani terpisah); jangan drop tabel/policy existing.

## Reuse desain login

`node sales/sync-existing-login.mjs` menghasilkan markup Login dari app/page.tsx, CSS/responsive dari app/globals.css dan logo existing. CI memakai `--check` untuk mendeteksi drift. Tidak ada source app existing yang diubah. Submit langsung ke `/sales`; Organization dan Role terpilih ditampilkan. Generator mempertahankan teks/desain existing; tidak membangun sistem login/user management baru.
