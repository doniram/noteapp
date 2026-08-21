# DevNotes

Aplikasi pencatatan teknis (dokumentasi konfigurasi server, SOP, troubleshooting) dengan UI berbahasa Indonesia. Berbasis **React + Vite** di frontend dan **Express + SQLite** di backend.

## Fitur

- Autentikasi JWT (login), satu pengguna — pendaftaran akun dinonaktifkan.
- Catatan berformat Markdown dengan live preview (Edit / Split / Preview).
- Folder, tag, pencarian cepat (FTS), sortir, dan pin.
- Template catatan (Konfigurasi Server, Troubleshooting, SOP, Kredensial, Catatan Teks).
- Lampiran file + **paste foto/gambar** langsung ke isi catatan.
- Ekspor Markdown / PDF.
- Halaman Pengaturan untuk sinkronisasi **Nextcloud via WebDAV** (password WebDAV disimpan terenkripsi AES-256-GCM).
- Responsif (mobile) dan tema terang / gelap.

## Teknologi

- **Frontend:** React, Vite, Tailwind CSS v4, lucide-react, react-markdown + remark-gfm + rehype-highlight.
- **Backend:** Express (v5), better-sqlite3, jsonwebtoken, bcryptjs, multer, webdav.
- **Database:** SQLite (mode WAL).

## Struktur

```
server/         Backend Express + SQLite
  index.js      Server & API routes
  db.js         Schema, migrasi, seed, koneksi SQLite
  devnotes.db   Database (gitignored)
  uploads/      File lampiran (gitignored)
src/            Frontend React
  components/   Komponen UI
  context/      AppContext (state global)
  data/         Seed data & template
  lib/          Utilitas
  App.jsx       Layout utama
index.html      Entry HTML (script anti-flash tema)
vite.config.js  Proxy /api -> localhost:4000
```

## Development

Pastikan Node.js (>= 18) dan npm terpasang.

```bash
npm install
npm run dev
```

`npm run dev` menjalankan dua proses sekaligus:

- **API (Express)** di `http://localhost:4000`
- **Vite (frontend)** di `http://localhost:5173` (proxy `/api` → 4000)

Buka `http://localhost:5173`. Server backend menggunakan `node --watch` sehingga otomatis reload saat ada perubahan.

## Build & Deploy Production

```bash
npm install
npm run build        # menghasilkan folder dist/
```

Jalankan server API (Express akan menyajikan file `dist/` sekaligus API-nya):

```bash
node server/index.js
# atau
npm run server
```

Aplikasi akan tersedia di `http://localhost:PORT` (default `4000`) — satu port untuk halaman + API.

### Variabel Lingkungan

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `PORT` | tidak | `4000` | Port untuk server & aplikasi |
| `JWT_SECRET` | **ya** | (tidak aman) | Kunci penandatanganan JWT & enkripsi password WebDAV. **Wajib diset nilai acak kuat di produksi.** |
| `ADMIN_PASSWORD` | **ya** | `admin123` | Password login aplikasi (satu pengguna). **Segera ganti di produksi.** |
| `DB_PATH` | tidak | `server/devnotes.db` | Path file database SQLite |
| `UPLOAD_DIR` | tidak | `server/uploads` | Folder penyimpanan lampiran |

Contoh menjalankan dengan env:

```bash
export JWT_SECRET="<nilai-acak-kuat>"
export ADMIN_PASSWORD="<password-kuat-milikmu>"
export PORT=4000
node server/index.js
```

> Pastikan `DB_PATH` dan `UPLOAD_DIR` berada di direktori yang **dapat ditulis** dan **persisten** (bukan di folder yang dihapus saat deploy, misal. di tmpfs).

### Proses daemon (pm2)

Contoh dengan **pm2**:

```bash
npm run build
pm2 start server/index.js --name devnotes
pm2 save
```

atau dengan **systemd** — pastikan service menjalankan `node server/index.js` dengan env yang sesuai, lalu reverse-proxy (misal. nginx) ke port tersebut.

> Contoh reverse proxy nginx:
> ```nginx
> location / {
>   proxy_pass http://127.0.0.1:4000;
>   proxy_set_header Host $host;
>   proxy_set_header X-Real-IP $remote_addr;
> }
> ```

### Login & Keamanan

- Aplikasi untuk **satu pengguna**. Login hanya butuh **1 password** dari env `ADMIN_PASSWORD` (tanpa username, tanpa registrasi).
- Jika `ADMIN_PASSWORD` tidak diset, memakai default `admin123` — **segera ganti di produksi**.
- Wajib menyetel `JWT_SECRET` ke nilai acak kuat. Menjaga kunci ini di produksi.
- File `.env`, `server/devnotes.db*`, dan `server/uploads/` sudah di-`.gitignore`.

> Contoh nilai `ADMIN_PASSWORD` untuk pengelolaan sendiri: cukup set satu password kuat saat deploy (misal. `ADMIN_PASSWORD=...` di `.env` / environment / Docker).

## Penggunaan

1. **Login** — masuk dengan password (dari env `ADMIN_PASSWORD`). Tanpa username, tanpa registrasi.
2. **Catatan** — buat catatan baru (`+ Catatan Baru`), pilih folder/ tag, sematkan (pin), dan tandai lampiran.
3. **Menu template** — dari sidebar tekan *Buat dari Template* untuk membuat catatan dari template terstruktur (server, troubleshooting, SOP, kredensial, catatan teks).
4. **Editor** — mendukung Markdown; toolbar format, ekspor `.md` / PDF, dan paste gambar. Pilih mode *Edit / Split / Preview*.
5. **Pencarian cepat** — `Ctrl + K` untuk command palette.
6. **Sinkronisasi WebDAV** — buka *Pengaturan* (ikon gerigi di sidebar), isi server/username/password WebDAV Nextcloud, lalu tombol *Sinkron*. Catatan disimpan sebagai `.md` ke folder `<path>/[<Folder>/]<judul>.md`. File lampiran tidak disinkronkan.

## Deploy dengan Docker

Proyek ini menyertakan `Dockerfile` dan `docker-compose.yml` (multi-stage: build frontend → runtime Node).

### Docker Compose (rekomendasi)

1. Set `JWT_SECRET` dan `ADMIN_PASSWORD` sebagai environment saat `docker compose up` (via file `.env` di folder proyek, atau shell):

   ```bash
   # .env (gitignored)
   JWT_SECRET=<nilai-acak-kuat>
   ADMIN_PASSWORD=<password-kuat-milikmu>
   ```

2. Jalankan:

   ```bash
   docker compose up -d --build
   ```

   Aplikasi tersedia di `http://localhost:4000`. Data (database + upload) disimpan di volume `devnotes-data` (mounted ke `/data`), jadi aman saat container di-restart/rebuild.

### Docker manual

```bash
docker build -t devnotes .
docker run -d --name devnotes \
  -p 4000:4000 \
  -e JWT_SECRET=<nilai-acak-kuat> \
  -e ADMIN_PASSWORD=<password-kuat-milikmu> \
  -v devnotes-data:/data \
  devnotes
```

### Aksi server mandiri (opsional)

Jika ingin berjalan sebagai service systemd di VPS:

```ini
# /etc/systemd/system/devnotes.service
[Unit]
Description=DevNotes
After=network.target

[Service]
WorkingDirectory=/opt/devnotes
Environment=NODE_ENV=production
Environment=PORT=4000
Environment=JWT_SECRET=<nilai-acak-kuat>
Environment=ADMIN_PASSWORD=<password-kuat-milikmu>
ExecStart=/usr/bin/node server/index.js
Restart=always
User=devnotes

[Install]
WantedBy=multi-user.target
```

lalu:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now devnotes
```

Lengkapi dengan reverse-proxy nginx/Caddy ke `http://127.0.0.1:4000`.

## Database & Backup

- Berkas database: `server/devnotes.db` (+ `-wal`, `-shm`).
- Lampiran: folder `server/uploads/`.
- Cadangkan keduanya bersama.
- Password WebDAV tersimpan terenkripsi di tabel `settings`; jangan hilangkan `JWT_SECRET` atau data tidak bisa didekripsi lagi.

## Perintah tersedia

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Jalankan development (server + vite) |
| `npm run build` | Build frontend ke `dist/` |
| `npm run server` | Jalankan server backend (watch) |
| `npm run preview` | Preview hasil build via Vite |
| `npm run lint` | Lint dengan oxlint |
