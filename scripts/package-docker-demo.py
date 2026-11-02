#!/usr/bin/env python3
"""Build a source-free Docker demo bundle for sales engineers."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "cluefy-docker-sales.zip"
IMAGE = "ghcr.io/bernadus-zntx/demo-cluefy:main"
FOLDER = "cluefy-docker/"


def add_text(archive: ZipFile, name: str, content: str, mode: int = 0o644) -> None:
    entry = ZipInfo(FOLDER + name)
    entry.create_system = 3
    entry.external_attr = (0o100000 | mode) << 16
    entry.compress_type = ZIP_DEFLATED
    archive.writestr(entry, content.replace("\n", "\r\n") if name.endswith(".bat") else content)


compose = (ROOT / "compose.yaml").read_text()
local_image = "${CLUEFY_APP_IMAGE:-cluefy-app:local}"
assert compose.count(local_image) == 2, "Expected backend and crawler image references"
assert compose.count("    build: .\n") == 1, "Expected one local build declaration"
compose = compose.replace(local_image, "${CLUEFY_APP_IMAGE:-" + IMAGE + "}")
compose = compose.replace("    build: .\n", "")

readme = f"""CLUEFY DOCKER DEMO — TIM SALES ENGINEER

Paket ini menjalankan ClueFy tanpa source code aplikasi. Docker akan mengunduh
image aplikasi ({IMAGE}) dan image pendukung saat pertama dijalankan.

PRASYARAT
- Docker Desktop atau Docker Engine + Docker Compose
- Koneksi internet saat instalasi dan pembaruan

PERTAMA KALI
Mac: klik dua kali "Mulai ClueFy.command".
Windows: klik dua kali "Mulai ClueFy.bat".
Setelah container siap, buka http://localhost:3107.

MEMPERBARUI APLIKASI
Mac: klik dua kali "Update ClueFy.command".
Windows: klik dua kali "Update ClueFy.bat".
Tombol ini mengambil image ClueFy terbaru dan memperbarui backend serta crawler.
Database lokal tetap tersimpan. Pembaruan skema database atau konfigurasi
Docker memerlukan paket ZIP baru dari pemilik produk.

MENGHENTIKAN
Buka Terminal/PowerShell di folder ini dan jalankan:
  docker compose --env-file .env.docker down

CATATAN
- Database lokal mulai kosong; crawler mengisi data dari aturan sumber.
- .env.docker dibuat di mesin masing-masing dan tidak boleh dibagikan.
- Untuk analisis AI crawler, isi OPENAI_API_KEY di .env.docker sendiri.
- Dashboard hanya bisa diakses dari mesin yang menjalankan Docker.
"""

start_mac = """#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker run --rm --user "$(id -u):$(id -g)" -v "$(pwd):/work" -w /work node:22-alpine node scripts/docker-setup.mjs
docker compose --env-file .env.docker up --pull always -d
docker compose --env-file .env.docker ps
echo "ClueFy siap di http://localhost:3107"
read -r -p "Tekan Enter untuk menutup..." _ || true
"""

update_mac = """#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env.docker ]]; then
  echo "Jalankan Mulai ClueFy.command dahulu."
  read -r -p "Tekan Enter untuk menutup..." _ || true
  exit 1
fi
docker compose --env-file .env.docker pull backend crawler
docker compose --env-file .env.docker up -d backend crawler
docker compose --env-file .env.docker ps
echo "ClueFy sudah memakai image aplikasi terbaru."
read -r -p "Tekan Enter untuk menutup..." _ || true
"""

start_windows = r"""@echo off
cd /d "%~dp0"
docker run --rm -v "%cd%:/work" -w /work node:22-alpine node scripts/docker-setup.mjs
if errorlevel 1 goto fail
docker compose --env-file .env.docker up --pull always -d
if errorlevel 1 goto fail
docker compose --env-file .env.docker ps
echo ClueFy siap di http://localhost:3107
pause
exit /b 0
:fail
echo ClueFy gagal dijalankan. Kirim pesan error di atas ke tim teknis.
pause
exit /b 1
"""

update_windows = r"""@echo off
cd /d "%~dp0"
if not exist ".env.docker" (
  echo Jalankan Mulai ClueFy.bat dahulu.
  pause
  exit /b 1
)
docker compose --env-file .env.docker pull backend crawler
if errorlevel 1 goto fail
docker compose --env-file .env.docker up -d backend crawler
if errorlevel 1 goto fail
docker compose --env-file .env.docker ps
echo ClueFy sudah memakai image aplikasi terbaru.
pause
exit /b 0
:fail
echo Update gagal. Kirim pesan error di atas ke tim teknis.
pause
exit /b 1
"""

files = [
    "docker/db/00-roles.sql",
    "docker/db/99-grants.sql",
    "docker/frontend/nginx.conf",
    "scripts/docker-setup.mjs",
    *(str(path.relative_to(ROOT)) for path in sorted((ROOT / "supabase/migrations").glob("*.sql"))),
]

OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
    add_text(archive, "README.txt", readme)
    add_text(archive, "compose.yaml", compose)
    add_text(archive, "Mulai ClueFy.command", start_mac, 0o755)
    add_text(archive, "Update ClueFy.command", update_mac, 0o755)
    add_text(archive, "Mulai ClueFy.bat", start_windows)
    add_text(archive, "Update ClueFy.bat", update_windows)
    for name in files:
        archive.write(ROOT / name, FOLDER + name)

print(OUTPUT)
