export const templates = [
  {
    id: 'template-server',
    name: 'Konfigurasi Server',
    desc: 'Hostname, IP, service, dan akses server baru.',
    content: `# Konfigurasi Server Baru

> Gunakan template ini untuk server baru.

## Informasi Server

| Field | Isi |
|---|---|
| Hostname |  |
| IP Address |  |
| OS | Ubuntu 22.04 LTS |
| Environment |  |
| Managed By |  |

## Service yang diinstall

- [ ] Nginx
- [ ] Docker
- [ ] Node exporter

## Cheat sheet

\`\`\`bash
hostnamectl set-hostname
ufw allow OpenSSH
\`\`\``,
  },
  {
    id: 'template-troubleshooting',
    name: 'Troubleshooting',
    desc: 'Gejala, diagnosis, solusi, dan pencegahan.',
    content: `# Troubleshooting: {Judul}

**Gejala:** 
**Terakhir terjadi:** 

## Diagnosis

\`\`\`bash
# perintah diagnosis
\`\`\`

## Solusi

\`\`\`bash
# perintah solusi
\`\`\`

## Pencegahan

- 
- `,
  },
  {
    id: 'template-sop',
    name: 'SOP / Prosedur',
    desc: 'Checklist langkah demi langkah.',
    content: `# SOP: {Nama Prosedur}

**Owner:** 
**Review terakhir:** 

## Prasyarat

- 

## Langkah

1. 
2. 
3. 

## Verifikasi

\`\`\`bash
# perintah verifikasi
\`\`\``,
  },
  {
    id: 'template-kredensial',
    name: 'Kredensial / Akses',
    desc: 'Simpan kredensial dasar akses terbatas.',
    content: `# Kredensial: {Nama Sistem}

> **Sensitive** — access terbatas. Jangan dishare di chat publik.

| Item | Nilai |
|---|---|
| Host |  |
| Port |  |
| User |  |
| Password |  |

## Cara akses

\`\`\`bash
\`\`\`

## Rotasi

**Jadwal rotasi berikutnya:** `,
  },
  {
    id: 'template-catatan-cepat',
    name: 'Catatan Teks (Biasa)',
    desc: 'Catatan teks polos tanpa format markdown, cocok untuk catatan bebas.',
    content: `Catatan teks biasa...

Tulis apa saja dengan bebas di sini. Tekan Enter untuk baris baru.
`,
  },
]