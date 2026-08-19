export const seedFolders = [
  { id: 'f1', name: 'Production Servers' },
  { id: 'f2', name: 'Staging' },
  { id: 'f3', name: 'Networking' },
  { id: 'f4', name: 'Database' },
  { id: 'f5', name: 'SOP & Prosedur' },
  { id: 'f6', name: 'Troubleshooting' },
]

export const seedTags = [
  { id: 't1', name: 'nginx', color: '#22c55e' },
  { id: 't2', name: 'ubuntu', color: '#eab308' },
  { id: 't3', name: 'database', color: '#38bdf8' },
  { id: 't4', name: 'urgent', color: '#ef4444' },
  { id: 't5', name: 'backend', color: '#a78bfa' },
  { id: 't6', name: 'devops', color: '#f472b6' },
]

export const seedNotes = [
  {
    id: 'n1',
    title: 'Konfigurasi Nginx - Production API Gateway',
    content: `# Production API Gateway — Nginx

Server: **web-01.prod.internal** (10.10.1.21)

## Server block

\`\`\`nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/nginx/ssl/api.example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/api.example.com.key;

    location /api/ {
        proxy_pass         http://backend-prod:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 5s;
        proxy_read_timeout     30s;
    }
}
\`\`\`

## Parameter penting

| Parameter           | Nilai  | Keterangan                  |
|---------------------|--------|-----------------------------|
| \`proxy_read_timeout\` | 30s    | Batas baca dari backend     |
| \`proxy_connect_timeout\` | 5s | Timeout koneksi ke backend  |
| \`worker_connections\` | 4096   | Di file \`nginx.conf\`        |

## Reload tanpa downtime

\`\`\`bash
sudo nginx -t && sudo systemctl reload nginx
\`\`\`

> Update terakhir: implementasi rate-limiting \`limit_req_zone\` diubah pada 17 Agu 2026.`,
    folderId: 'f1',
    tags: ['t1', 't2', 't6'],
    pinned: true,
    createdAt: '2026-07-02T09:12:00Z',
    updatedAt: '2026-08-17T14:30:00Z',
    attachments: [
      { name: 'nginx-prod.conf', size: '2.1 KB', type: 'config' },
      { name: 'ssl-check.txt', size: '344 B', type: 'text' },
    ],
  },
  {
    id: 'n2',
    title: 'Restart Service Backend (Playbook)',
    content: `# Playbook Restart Backend

SOP saat service \`backend-prod\` bermasalah.

## 1. Cek status

\`\`\`bash
sudo systemctl status backend-prod
journalctl -u backend-prod --since "10 min ago"
\`\`\`

## 2. Restart

\`\`\`bash
sudo systemctl restart backend-prod
sleep 5
sudo systemctl --failed
curl -s http://localhost:8080/health | jq .
\`\`\`

## 3. Rollback cepat

\`\`\`bash
sudo systemctl revert backend-prod
\`\`\`

## Checklist

- [x] Health check lulus
- [ ] Notifikasi ke tim via Slack
- [ ] Update runbook jika ada temuan baru`,
    folderId: 'f5',
    tags: ['t5', 't6'],
    pinned: true,
    createdAt: '2026-07-10T03:40:00Z',
    updatedAt: '2026-08-16T10:05:00Z',
    attachments: [],
  },
  {
    id: 'n3',
    title: 'PostgreSQL - Tuning & Replikasi Streaming',
    content: `# PostgreSQL 16 — Tuning Production

Server KB: \`db-replica-01\` (10.10.2.15, streaming replica)

## postgresql.conf utama

\`\`\`ini
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 16MB
max_connections = 200
wal_level = replica
max_wal_senders = 10
checkpoint_timeout = 15min
\`\`\`

## Cek status replikasi

\`\`\`sql
SELECT client_addr, state, sent_lsn, replay_lsn,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes
FROM pg_stat_replication;
\`\`\`

## Query lambat (slow query log)

\`\`\`bash
tail -f /var/log/postgresql/postgresql-16-main.log | rg "duration:"
\`\`\`

## Drainase replica untuk maintenance

\`\`\`bash
sudo systemctl stop postgresql@16-main
sudo -u postgres pg_ctlcluster 16 main promote
\`\`\``,
    folderId: 'f4',
    tags: ['t3', 't2'],
    pinned: false,
    createdAt: '2026-07-05T11:22:00Z',
    updatedAt: '2026-08-14T08:12:00Z',
    attachments: [
      { name: 'postgresql.conf', size: '18 KB', type: 'config' },
    ],
  },
  {
    id: 'n4',
    title: 'Firewall UFW - Aturan egress & ingress',
    content: `# UFW Firewall Rules

Aturan firewall standar untuk semua server Ubuntu 22.04.

## Ingress — hanya yang dibutuhkan

\`\`\`bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow 22/tcp        # SSH
sudo ufw allow 443/tcp       # HTTPS
sudo ufw allow 5432/tcp from 10.10.0.0/16  # PostgreSQL (internal)
\`\`\`

## Egress — whitelist selective

> Pipeline CI perlu akses \`api.github.com\` dan repo internal.

\`\`\`bash
sudo ufw allow out to 140.82.112.0/20        # GitHub
sudo ufw allow out to 10.10.0.0/16           # jaringan internal
\`\`\`

## Verifikasi

\`\`\`bash
sudo ufw status numbered
sudo ufw show added
\`\`\` ## catatan
- Jangan pernah \`ufw disable\` tanpa koordinasi tim.
- Perubahan disetujui di #infra pada 11 Agu 2026.`,
    folderId: 'f3',
    tags: ['t2', 't6'],
    pinned: false,
    createdAt: '2026-06-28T07:55:00Z',
    updatedAt: '2026-08-11T16:20:00Z',
    attachments: [],
  },
  {
    id: 'n5',
    title: 'Troubleshooting: SSL Certificate Expired (Let\'s Encrypt)',
    content: `# Troubleshooting — SSL Certificate Expired

**Gejala:** browser menampilkan \`NET::ERR_CERT_DATE_INVALID\` pada 19 Agu 2026.

## Diagnosis

\`\`\`bash
echo | openssl s_client -servername api.example.com \\
  -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates
\`\`\`

## Solusi — renew manual

\`\`\`bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
\`\`\`

## Cek cron renew

\`\`\`bash
systemctl list-timers | grep certbot
\`\`\`

## Pencegahan

- Tambah monitoring expiry ke Prometheus + alert di \`21 hari\`.
- Test proses renew di staging setiap bulan.`,
    folderId: 'f6',
    tags: ['t1', 't4', 't6'],
    pinned: true,
    createdAt: '2026-08-19T00:40:00Z',
    updatedAt: '2026-08-19T09:15:00Z',
    attachments: [
      { name: 'certbot-log.txt', size: '5.6 KB', type: 'log' },
    ],
  },
  {
    id: 'n6',
    title: 'Setup Environment Backend Dev (Node 20 + Yarn)',
    content: `# Setup Env Backend Dev

## Prasyarat

- Node.js 20.x (LTS)
- Yarn classic 1.22

\`\`\`bash
nvm install 20
nvm use 20
corepack enable
\`\`\`

## Install & run

\`\`\`bash
git clone git@github.com:acme/backend.git
cd backend
cp .env.example .env
yarn install
yarn dev
\`\`\`

## .env yang wajib diisi

| Key              | Contoh                          |
|------------------|---------------------------------|
| \`DATABASE_URL\`    | postgres://dev:dev@localhost:5432/acme |
| \`JWT_SECRET\`      | panjang 32+ karakter            |
| \`REDIS_URL\`       | redis://localhost:6379          |

## Common issues

- \`yarn install\` gagal → cek \`node-gyp\` & Python 3.
- Port 8080 dipakai → \`PORT=9090 yarn dev\`.`,
    folderId: 'f2',
    tags: ['t5'],
    pinned: false,
    createdAt: '2026-07-20T13:10:00Z',
    updatedAt: '2026-08-02T04:45:00Z',
    attachments: [],
  },
  {
    id: 'n7',
    title: 'Kredensial Staging DB (internal only)',
    content: `# Kredensial Staging Database

> **Sensitive** — access terbatas. Jangan di-share di chat publik.

| Item        | Nilai                |
|-------------|----------------------|
| Host        | db-staging.internal  |
| Port        | 5432                 |
| User        | app_stage            |
| Password    | \`s3cr3t-staging-2026\` |
| Database    | acme_staging         |

## Cara konek

\`\`\`bash
PGPASSWORD='s3cr3t-staging-2026' \\
  psql -h db-staging.internal -U app_stage acme_staging
\`\`\`

## Rotasi

Rotasi password dilakukan setiap 90 hari → **jadwal berikutnya: 12 Nov 2026**.`,
    folderId: 'f2',
    tags: ['t3', 't5'],
    pinned: false,
    sensitive: true,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-13T10:00:00Z',
    attachments: [],
  },
  {
    id: 'n8',
    title: 'Template: Konfigurasi Server Baru',
    content: `# Konfigurasi Server Baru

> Gunakan template ini untuk server baru di lingkungan **{#env}**.

## Informasi Server

| Field        | Isi                    |
|--------------|------------------------|
| Hostname     | {#hostname}            |
| IP Address   | {#ip}                  |
| OS           | Ubuntu 22.04 LTS       |
| Environment  | {#env}                 |
| Managed By   | {#owner}               |

## Service yang diinstall

- [ ] Docker + compose
- [ ] Nginx
- [ ] Node exporter (Prometheus)
- [ ] Fail2ban

## Akses

| User | Peran |
|------|-------|
| deploy | Deploy aplikasi |
| root | Diagnostik |

## Cheat sheet

\`\`\`bash
hostnamectl set-hostname {#hostname}
ufw allow OpenSSH
\`\`\``,
    folderId: null,
    tags: ['t6'],
    pinned: false,
    createdAt: '2026-06-25T02:00:00Z',
    updatedAt: '2026-06-25T02:00:00Z',
    attachments: [],
  },
]