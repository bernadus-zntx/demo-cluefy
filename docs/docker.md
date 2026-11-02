# Menjalankan ClueFy dengan Docker

Compose menjalankan lima container yang membentuk tiga lapisan:

| Lapisan | Service | Fungsi |
| --- | --- | --- |
| Database | `db` | PostgreSQL dengan volume persisten dan migrasi crawler |
| Backend | `rest`, `backend`, `crawler` | PostgREST untuk akses database, Next.js API, dan crawler tiap 10 menit |
| Frontend | `frontend` | Nginx sebagai satu alamat untuk dashboard dan API |

Next.js di proyek ini memang berisi halaman dan API dalam satu aplikasi. Service `frontend` meneruskan halaman ke `backend` dan permintaan database ke `rest`. Crawler menggunakan API backend yang sama sehingga deduplikasi tetap berlaku.

## Pertama kali

Pastikan Docker Engine dan Docker Compose terpasang. Dari direktori proyek:

```bash
node scripts/docker-setup.mjs
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
```

Buka <http://localhost:3107>. Jika ingin mengubah port, edit `CLUEFY_PORT` di `.env.docker` sebelum menjalankan Compose. File ini berisi password dan token yang dibuat khusus untuk instalasi Docker; jangan commit atau bagikan. Isi `OPENAI_API_KEY` di file itu bila analisis AI crawler diperlukan. Tanpa key, crawler tetap mengambil konten dan menyimpan klasifikasi awal.

Database baru menjalankan semua file di `supabase/migrations/` pada saat volume pertama dibuat. Migrasi tidak dijalankan ulang pada volume yang sudah ada. Database Docker mulai kosong dan **tidak menyalin data dari Supabase cloud**; crawler akan mengisi data baru dari aturan sumber yang sudah di-seed. Jika tim membutuhkan salinan data lama, migrasikan dengan prosedur backup/restore terpisah sebelum memakai stack ini.

## Membagikan image ke tim

Setiap perubahan di branch `main` menjalankan smoke test Docker. Jika lulus, GitHub Actions menerbitkan image aplikasi untuk `backend` dan `crawler` ke `ghcr.io/bernadus-zntx/demo-cluefy:main` untuk `linux/amd64` dan `linux/arm64`. Tag `sha-<commit>` juga diterbitkan agar tim bisa memakai versi yang tetap. PostgreSQL, PostgREST, dan Nginx menggunakan image resmi/public yang sudah tercantum di Compose.

Tim tetap perlu clone repo karena Compose memakai file migrasi database dan konfigurasi Nginx dari repo. Dari direktori proyek di mesin tim:

```bash
node scripts/docker-setup.mjs
CLUEFY_APP_IMAGE=ghcr.io/bernadus-zntx/demo-cluefy:main \
  docker compose --env-file .env.docker up --pull always --no-build -d
```

Dashboard tersedia di <http://localhost:3107>. Ulangi perintah `up` untuk mengambil image terbaru. Untuk mengunci satu rilis, ganti `:main` dengan tag `:sha-<commit>` yang terlihat di [GitHub Packages](https://github.com/bernadus-zntx/demo-cluefy/pkgs/container/demo-cluefy). Jika package GHCR masih private, pemilik package harus memberi tim akses baca; tiap anggota login ke `ghcr.io` memakai GitHub personal access token (classic) dengan scope `read:packages` sebelum menjalankan Compose. Jangan bagikan `.env.docker` atau token ke tim; tiap mesin membuat kredensialnya sendiri.

## Operasi

```bash
docker compose --env-file .env.docker logs -f backend crawler
docker compose --env-file .env.docker restart crawler
docker compose --env-file .env.docker down
```

`down` menghentikan container dan mempertahankan volume database. Jangan memakai `down -v` kecuali memang ingin menghapus database lokal.

Untuk menjalankan dashboard tanpa crawler berkala, gunakan:

```bash
docker compose --env-file .env.docker up --build -d db rest backend frontend
```

Database dan PostgREST tidak membuka port langsung ke host. Hanya port dashboard yang terikat ke `127.0.0.1`. Login demo aplikasi saat ini belum menyediakan autentikasi server; sebelum membuka stack ke jaringan luar, pasang autentikasi dan HTTPS di depan gateway.

## Validasi cepat

```bash
curl -f http://localhost:3107/api/intelligence/live
docker compose --env-file .env.docker exec db psql -U postgres -d cluefy -c "select count(*) from public.crawler_rules;"
```

Respons API harus berisi `configured: true`. Jumlah aturan crawler harus lebih dari nol setelah inisialisasi database pertama.
