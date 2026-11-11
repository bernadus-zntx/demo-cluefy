# ClueFy Sales — review candidate

Aplikasi terpisah untuk melihat maksimal 100 artikel terbaru yang dapat dibaca oleh role anon di Supabase hosted production. Pencarian hanya atas sampel yang sedang ditampilkan, bukan seluruh database. Ini viewer Sales minimal, bukan seluruh fitur dashboard existing.

Tidak ada dependency npm, crawler, Postgres, PostgREST lokal, migrasi, RPC, SDK admin, write route, atau fetch isi artikel. Browser hanya membaca API Sales; key berada di server. Server hanya mengirim GET ke satu endpoint tetap dengan proyeksi kolom terbatas. Cache 30 detik dan penggabungan request serentak mengurangi beban. Data teks memakai textContent dan CSP melarang skrip inline.

## Batas akses production

Jangan isi konfigurasi atau jalankan langkah koneksi/deployment sebelum persetujuan user. `.env.example` sengaja kosong. Hanya publishable key atau JWT legacy dengan role anon diterima; signature JWT tetap diverifikasi Supabase. Secret/service_role ditolak. Tidak ada fallback admin atau pemakaian credentials dari dashboard existing.

Publishable/anon key **bukan credential read-only secara intrinsik**: izin sebenarnya tetap ditentukan grants/RLS production. Jaminan GET-only di sini berlaku untuk aplikasi Sales ini. Jika anon punya write policy di tempat lain, key yang sama dapat dipakai di luar aplikasi; audit izin existing harus mengonfirmasi kebutuhan organisasi sebelum aktivasi.

Konteks chat menunjukkan RLS aktif tanpa policy pada crawl_items. Jika masih demikian, respons dapat kosong atau ditolak. Respons kosong tidak membuktikan database kosong atau koneksi live berhasil. Tanpa izin baca yang sudah ada, persyaratan live data + tanpa perubahan policy/schema tidak bisa dipenuhi. Hentikan aktivasi dan minta keputusan user; jangan gunakan service_role untuk mengatasinya.

## Validasi tanpa production

Dari root repo:

```sh
node --test sales/tests/*.test.mjs
node --check sales/server.mjs
node --check sales/public/app.js
docker compose -f sales/compose.yaml config --quiet
docker build -t cluefy-sales:review sales
```

Tes memakai fetch tiruan dan port loopback sementara, tanpa koneksi production. Workflow Sales hanya validasi PR, tanpa secrets, publish, atau deploy. Workflow existing tetap ada; membuat PR juga dapat memicu Docker smoke existing (database lokal di runner CI), jadi review sebelum push/PR. Tidak ada PR/push dilakukan pada pekerjaan ini.

## Rencana Debian SETELAH persetujuan

1. Periksa `docker compose ls`, container/volume/network existing, kapasitas RAM/disk, dan `ss -ltn` untuk memastikan 3117 bebas. Ini belum diperiksa pada host Debian/iCentra.
2. Tempatkan hanya folder sales di direktori baru, misalnya `/opt/cluefy-sales`; jangan timpa checkout, Compose, environment, proxy, network, atau volume ClueFy/iCentra. Gunakan project name `cluefy-sales` yang unik; jangan override dengan nama project existing.
3. User memasukkan URL production dan publishable/anon key yang disetujui ke file konfigurasi Sales sendiri dengan izin file 600. Jangan salin `.env` existing. Jangan commit file tersebut.
4. Validasi konfigurasi dengan `config --quiet` (hindari mencetak konfigurasi berisi key), lalu build image Sales. Setelah persetujuan deployment, jalankan hanya Compose Sales dengan file konfigurasi eksplisit. Tidak ada volumes/shared network/host network/container_name.
5. Port default `127.0.0.1:3117`; akses lewat SSH tunnel. Jangan buka ke internet tanpa autentikasi yang disetujui. Tidak ada user login di viewer ini. Jangan mengubah reverse proxy existing pada tahap ini.
6. Periksa `/healthz` untuk proses (bukan bukti akses DB), lalu `/api/items` untuk koneksi dengan GET. Cocokkan sampel yang diizinkan bersama pemilik data. Jangan melakukan percobaan INSERT/PATCH/DELETE terhadap production untuk menguji read-only.
7. Pantau resource dan health iCentra/ClueFy sebelum/sesudah. Rollback hanya `docker compose -p cluefy-sales -f /opt/cluefy-sales/compose.yaml down` dengan file environment Sales bila diperlukan. Jangan gunakan `down -v`, prune, atau stop layanan existing.

Dockerfile hanya menyalin server dan assets dari build context Sales yang di-allowlist. Container berjalan sebagai non-root, filesystem read-only, capability dibuang, dan resource dibatasi. Base image belum dipin digest; pin digest yang disetujui setelah build dan scan sebelum deploy.
