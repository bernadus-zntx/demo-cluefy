# Audit ClueFy dan kandidat Sales

Tanggal: 11 November 2026. Basis: commit `54bbd45863ecaa01a0a85c1ce52e2c6882016f53` repository bernadus-zntx/demo-cluefy. Branch lokal: `codex/cluefy-sales-readonly`.

Audit statis source, bukan penetration test deployment atau pemeriksaan langsung Supabase/Debian. Chat sebelumnya hanya menyediakan hasil RLS/ACL dari user; isi jawaban assistant lama tidak dapat dipulihkan dari referensi konten. Tidak ada secrets dibaca/diisi, query production, perubahan policy/schema, push, PR, atau deployment.

## Temuan

| Prioritas | Lokasi | Temuan dan implikasi |
|---|---|---|
| Kritis | `lib/supabase-admin.ts:6-29` | Seluruh client server mengambil SUPABASE_SECRET_KEY atau SERVICE_ROLE dan melewati RLS. Publishable key yang diatur workflow tidak digunakan client ini. Jangan reuse client untuk Sales. |
| Kritis | `app/api/intelligence/items/[id]/route.ts` | PATCH/DELETE tanpa autentikasi/otorisasi pengguna; DELETE menulis blocked rule lalu hard delete. Confirm string bukan otorisasi. Identitas validator hardcoded. Bila endpoint dapat dijangkau publik dan key aktif, pemanggil dapat memutasi data. |
| Tinggi | `app/api/media-partners/route.ts`, `app/api/crawler-config/route.ts` | Mutasi hanya memakai same-origin yang menerima Origin kosong. Klien non-browser dapat melewatinya. Tidak ada pemeriksaan user/role. GET config membuka semua kolom rules. |
| Tinggi | `app/api/intelligence/items/[id]/content/route.ts` | POST tanpa otorisasi mengambil URL eksternal dan menulis hasil ke DB. Bukan operasi baca meskipun dipicu saat menampilkan artikel. |
| Tinggi | `lib/article-content.ts:18-24,96-100` | Penolakan hostname/IP literal belum melindungi DNS ke private IP, IPv6/private ranges lengkap atau redirect ke jaringan internal; fetch mengikuti redirect tanpa validasi ulang. Risiko SSRF perlu penanganan terpisah pada existing. Tidak disertakan di Sales. |
| Tinggi | `app/api/intelligence/live/route.ts` | GET tanpa user auth membaca dengan key admin termasuk body, raw metadata terpilih, history, komentar, rules dan error run. Pagination metadata/partner memakai pembacaan semua halaman; potensi eksposur dan beban. |
| Sedang | `app/api/crawler/{ingest,runs,enrich,rules}` dan `lib/crawler.ts:88` | Memeriksa shared bearer token dengan timingSafeEqual; bukan endpoint publik tanpa token. Tetap akses admin dan operasi write/RPC. Sales tidak memasukkan route ini atau token crawler. |
| Tinggi | `app/intelligence/AspirasiWarga.tsx:162,166-167,221,232-233`, `app/page.tsx:216`, `CrawlerConfiguration.tsx` | View dapat otomatis POST pengayaan konten dan PATCH viewed; tersedia klasifikasi/validasi/hard-delete/partner/rule mutations. Menyembunyikan tombol atau mengganti key saja belum menjadikan dashboard baca saja. |
| Sedang | Frontend Supabase access | Pencarian source app/lib menemukan createClient hanya di lib/supabase-admin.ts; frontend memanggil API lokal, bukan Supabase SDK langsung. Tidak ada bukti service key di browser dari source yang diaudit, tetapi API server menjadi jalur privilege. Bundle deployed belum diperiksa. |
| Tinggi | `compose.yaml`, `Dockerfile` | Compose default menjalankan DB, REST, backend, nginx dan crawler; backend memakai service key lokal dan image membawa worker. Salah memakai Compose ini melanggar arsitektur Sales. Root stack tidak digunakan/diubah. |
| Tinggi | `.github/workflows/deploy-production.yml` | Push main/manual dapat deploy production Vercel; admin/crawler credentials diteruskan build dan runtime. Bukan pipeline aman untuk Sales. |
| Sedang | `.github/workflows/crawler-schedule.yml`, `.github/workflows/docker-smoke.yml` | Crawler terjadwal mengarah production; Docker workflow smoke menjalankan DB/REST lokal dan publish image pada main/manual yang memenuhi kondisi. Jangan trigger untuk validasi Sales. Pipeline Sales tambahan hanya tes/build PR. |

Tidak dilakukan dependency/CVE scan menyeluruh.

## Keputusan implementasi

Semua perubahan aplikasi berada di `sales/`, ditambah workflow validasi Sales dan laporan ini. Existing app/lib/Compose/Dockerfile/migrations/workflows tidak diubah. Viewer baru memiliki route GET allowlist, proyeksi tujuh kolom, batas 100 artikel, fixed upstream hosted HTTPS, timeout, redirect ditolak, cache 30 detik, error disanitasi, tanpa fungsi tulis/RPC/publisher fetch. Bukan proxy generik terhadap REST production.

Satu service terisolasi dengan project Compose cluefy-sales dan port loopback 3117 (existing memakai 3107). Tidak ada volume bersama atau network external; resource limit mengurangi risiko, tetapi tidak membuktikan host Debian aman tanpa pemeriksaan kapasitas/port. Tanpa login, akses dibatasi loopback/SSH tunnel.

RLS tanpa policy pada crawl_items (berdasarkan chat, belum diverifikasi saat ini) memblokir anon. Implementasi siap untuk izin baca existing, tetapi live data belum dinyatakan berfungsi. Jika memang tidak ada policy baca yang sesuai, aktivasi diblokir sampai user menentukan opsi; tidak ada workaround key admin.

## Validasi dan persetujuan

- Empat tes otomatis lulus: penolakan credentials privileged/URL tidak aman; semua metode mutasi dan route lama tanpa outbound; fixed GET/proyeksi/cache/key tidak bocor di respons; status belum dikonfigurasi/RLS kosong/upstream denied.
- Pemeriksaan sintaks server/frontend dan whitespace lulus.
- HTTP test memakai loopback sementara dan fetch tiruan; tidak ada production request.
- Docker tidak tersedia di lingkungan audit: Compose config, image build, smoke container dan scan image belum dijalankan. Workflow disiapkan, belum dieksekusi.
- Node lokal v24.20.0; validasi Node 22 container/CI masih menunggu.
- UI belum diverifikasi screenshot browser. Existing Next build tidak dijalankan karena source/dependency existing tidak berubah; ini tidak menilai kesehatan deployment existing.

Sebelum aktivasi perlu persetujuan user atas audit, lingkup viewer minimal, sumber/kolom data yang boleh tampil, dan cara akses. Berikutnya validasi izin baca existing secara read-only dengan konfigurasi yang disetujui, lalu review host Debian dan build container. Deployment tetap memerlukan persetujuan terpisah. Detail prosedur di `sales/README.md`.

Referensi resmi: https://supabase.com/docs/guides/getting-started/api-keys dan https://supabase.com/docs/guides/database/postgres/row-level-security — publishable tunduk RLS, secret bypass RLS, dan RLS tanpa policy menolak akses anon.
