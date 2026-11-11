# ClueFy Sales — demo UI, production access blocked

Keputusan user: gunakan login demo existing tanpa membangun authentication/user management baru. Form Sales mengikuti perilaku demo: input email/password hanya membuka tampilan lokal, tidak memverifikasi identitas, tidak mengirim/menyimpan password, dan tidak memberikan izin API. **Ini bukan autentikasi atau pembatas akses internal ZNTX.** Jangan masukkan password sungguhan.

Audit mengonfirmasi `app/page.tsx` hanya memanggil setLoggedIn(true), dan docs/operational-features.md menyatakan login tidak mengautentikasi. Helper app/chatgpt-auth.ts tidak digunakan dan header identitas bukan bukti session terpercaya. User mengonfirmasi demo ini yang digunakan app.cluefy.co.

## Status dan batas data

Viewer membaca maksimal 100 artikel (judul, excerpt, penerbit, platform, lokasi, waktu; pencarian lokal). Tidak ada crawler, database lokal, PostgREST lokal, mutasi, RPC, atau pengambilan artikel eksternal.

**Akses production sengaja terkunci.** Login demo tidak menghasilkan identitas/JWT untuk RLS. API menolak semua permintaan data secara default (401) dan tidak mengirim query anon ke production, walaupun publishable key dikonfigurasi. Klaim “semua fitur live” atau “database read-only terverifikasi” belum dapat diberikan.

Batas integrasi server `authenticate` disiapkan untuk session existing yang terverifikasi: userId, internalZntx dan accessToken. Belum ada adapter production terpasang; CLI selalu memakai deny-by-default. Hanya tes yang menyuntikkan identitas tiruan. Tidak boleh membuat adapter dari form demo, header user/email, atau JWT yang hanya di-decode. Adapter nyata harus memverifikasi session/token, expiry, issuer/audience, dan keanggotaan ZNTX dari sumber terpercaya. Ini bukan sistem login baru dan belum merupakan integrasi auth yang selesai.

Jika suatu hari adapter tersedia, tiap request memakai token user di Authorization bersama public application key dan tunduk RLS; tidak ada shared cache antar-user. Tidak ada fallback anon/admin. Key secret/service_role ditolak. Proyeksi endpoint tetap, timeout 8 detik, redirect ditolak, error disanitasi dan CSP/textContent melindungi rendering.

Publishable key bukan izin database read-only. Sebelum aktivasi harus dibuktikan grants/RLS membolehkan hanya SELECT yang dibutuhkan dan menolak mutasi serta RPC berefek tulis untuk identitas Sales, termasuk lewat API langsung. Bila identitas authenticated existing dapat menulis, token itu tidak memenuhi persyaratan Sales. Jangan revoke hak authenticated secara global karena dapat merusak existing. Tidak ada policy/schema/grants production diubah pada pekerjaan ini.

## Validasi

```sh
node --test sales/tests/*.test.mjs
node --check sales/server.mjs
node --check sales/public/app.js
docker compose -f sales/compose.yaml config --quiet
docker build -t cluefy-sales:review sales
```

Enam tes menggunakan loopback dan upstream tiruan, tanpa production/secrets. Docker belum tersedia di lingkungan development; Compose/build/smoke container belum dijalankan. Workflow PR Sales mengetes dan build saja, tanpa deploy/secrets. Workflow existing tetap dapat berjalan sesuai trigger-nya.

## Debian: hanya setelah persetujuan deployment

1. Periksa kapasitas, container/network/volume existing, dan port 3117 (`ss -ltn`). Jangan menyentuh ClueFy existing atau iCentra.
2. Tempatkan folder sales dalam direktori baru `/opt/cluefy-sales`. Compose memakai project unik cluefy-sales, satu container non-root, tanpa volume/network external, resource limit dan filesystem read-only.
3. Build dan jalankan hanya `sales/compose.yaml`; jangan root Compose. Port tetap loopback `127.0.0.1:3117`; gunakan SSH tunnel. Login demo bukan alasan membuka service ke internet.
4. Untuk review demo biarkan konfigurasi Supabase kosong; healthz membuktikan proses sehat, bukan koneksi data. API akan tetap 401, termasuk setelah demo login.
5. Jangan isi secrets atau mengaktifkan data sebelum jalur identity + database read-only diselesaikan dan disetujui. Gunakan konfigurasi terpisah berizin 600, tidak menyalin .env existing. Jangan mencetak config berisi key.
6. Sesudah jalur tersebut disetujui, uji baca sampel production dengan GET dan inspeksi grants/RLS secara read-only. Jangan mencoba mutasi terhadap production untuk validasi.
7. Rollback hanya project Sales dengan `docker compose -p cluefy-sales -f /opt/cluefy-sales/compose.yaml down` (sertakan environment Sales bila diperlukan). Jangan prune, down -v, atau stop existing.

Build context Docker hanya allowlist server/assets; tidak membawa secrets, worker, atau migration. Tidak ada deployment dilakukan. Base image belum dipin digest/discan. Tampilan demo tidak menyelesaikan persyaratan keamanan level database; jangan mengiklankan kandidat ini sebagai siap production.
