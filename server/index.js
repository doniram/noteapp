import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from 'webdav'
import { fileURLToPath } from 'node:url'
import { db, seedAdmin, seedIfEmpty, rowToNote, buildSnippet, ftsMatch } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4000
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')
const JWT_SECRET = process.env.JWT_SECRET || 'devnotes-dev-secret-change-me'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ENC_KEY = crypto.createHash('sha256').update(JWT_SECRET).digest()

// Jangan pernah menjalankan produksi dengan kredensial default: siapa pun yang
// tahu default bisa login, memalsukan JWT, dan mendekripsi password WebDAV.
if (process.env.NODE_ENV === 'production') {
  const problems = []
  if (!process.env.JWT_SECRET || JWT_SECRET === 'devnotes-dev-secret-change-me') {
    problems.push('JWT_SECRET')
  }
  if (!process.env.ADMIN_PASSWORD || ADMIN_PASSWORD === 'admin123') {
    problems.push('ADMIN_PASSWORD')
  }
  if (problems.length) {
    console.error(
      `[FATAL] Set ${problems.join(' & ')} ke nilai acak/kuat sebelum menjalankan di produksi. Server dihentikan.`
    )
    process.exit(1)
  }
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false)
app.use(
  helmet({
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        // Biarkan deploy HTTP/internal tetap bekerja; HSTS tetap aktif di HTTPS.
        'upgrade-insecure-requests': null,
      },
    },
  })
)
app.use(express.json({ limit: '10mb' }))

const LOGIN_MAX = Number(process.env.LOGIN_RATE_MAX || 10)
const LOGIN_WINDOW = Number(process.env.LOGIN_RATE_WINDOW_MIN || 15) * 60 * 1000
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW,
  max: LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
})

const adminId = seedAdmin()
seedIfEmpty(adminId)

// ---------- helpers ----------
const id = () => crypto.randomUUID()

const signToken = (user) =>
  jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  let token = header.startsWith('Bearer ') ? header.slice(7) : ''
  // Token lewat query hanya untuk endpoint lampiran (dipakai oleh tag <img>,
  // yang tidak bisa mengirim header Authorization).
  if (!token && isAttachmentRequest(req)) token = String(req.query?.token || '')
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' })
  }
}

function isAttachmentRequest(req) {
  const url = req.originalUrl || req.url || ''
  return url.startsWith('/api/attachments/') || url.startsWith('/attachments/')
}

function getTagsForNotes(noteIds) {
  if (!noteIds.length) return new Map()
  const placeholders = noteIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT nt.note_id, nt.tag_id, t.name, t.color
       FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
       WHERE nt.note_id IN (${placeholders})
       ORDER BY t.name`
    )
    .all(...noteIds)
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.note_id)) map.set(r.note_id, [])
    map.get(r.note_id).push({ id: r.tag_id, name: r.name, color: r.color })
  }
  return map
}

function getAttachmentsForNotes(noteIds) {
  if (!noteIds.length) return new Map()
  const placeholders = noteIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT * FROM attachments WHERE note_id IN (${placeholders}) ORDER BY created_at`
    )
    .all(...noteIds)
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.note_id)) map.set(r.note_id, [])
    map.get(r.note_id).push({ id: r.id, name: r.name, size: r.size, type: r.type })
  }
  return map
}

function decorate(note, query) {
  const full = { ...note, snippet: undefined }
  if (query) full.snippet = buildSnippet(note.content, query)
  return full
}

const BASE_SELECT = `
  SELECT n.rowid, n.id, n.title, n.content, n.folder_id, n.pinned,
         n.created_at, n.updated_at
  FROM notes n
`

function queryNotes({ userId, search, folder, tag, sort, limit }) {
  const where = ['n.user_id = ?']
  const params = [userId]

  if (search && search.trim()) {
    where.push('n.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)')
    params.push(ftsMatch(search))
  }
  if (folder === 'pinned') {
    where.push('n.pinned = 1')
  } else if (folder === 'none') {
    where.push('n.folder_id IS NULL')
  } else if (folder) {
    where.push('n.folder_id = ?')
    params.push(folder)
  }
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM note_tags nt WHERE nt.note_id = n.id AND nt.tag_id = ?)')
    params.push(tag)
  }

  const order =
    sort === 'title'
      ? 'n.title COLLATE NOCASE ASC'
      : sort === 'created'
        ? 'n.created_at DESC'
        : 'n.updated_at DESC'

  let sql = BASE_SELECT
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ` ORDER BY ${order}`
  if (limit) sql += ' LIMIT ?'

  const rows = limit ? db.prepare(sql).all(...params, limit) : db.prepare(sql).all(...params)
  if (!rows.length) return []

  const ids = rows.map((r) => r.id)
  const tagMap = getTagsForNotes(ids)
  const attMap = getAttachmentsForNotes(ids)

  return rows.map((r) => {
    const note = rowToNote(r)
    note.tags = tagMap.get(r.id)?.map((t) => t.id) ?? []
    note.attachments = attMap.get(r.id) ?? []
    return decorate(note, search)
  })
}

function getNoteById(id, userId) {
  const row = db.prepare(`${BASE_SELECT} WHERE n.id = ? AND n.user_id = ?`).get(id, userId)
  if (!row) return null
  const note = rowToNote(row)
  const tagMap = getTagsForNotes([id])
  const attMap = getAttachmentsForNotes([id])
  note.tags = tagMap.get(id)?.map((t) => t.id) ?? []
  note.attachments = attMap.get(id) ?? []
  return note
}

function saveTags(noteId, tagIds) {
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
  const ins = db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')
  for (const t of tagIds || []) ins.run(noteId, t)
}

function parseNoteBody(body, existing = {}) {
  return {
    title: String(body.title ?? existing.title ?? 'Catatan Baru'),
    content: String(body.content ?? existing.content ?? ''),
    folder_id: body.folderId !== undefined ? body.folderId : existing.folderId,
    pinned: body.pinned !== undefined ? (body.pinned ? 1 : 0) : existing.pinned ? 1 : 0,
  }
}

// Hanya izinkan folder_id milik pengguna (atau null), jangan percaya input mentah.
function ownedFolderId(folderId, userId) {
  if (!folderId) return null
  const row = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId)
  return row ? folderId : null
}

// ---------- nextcloud / webdav ----------
function encryptSecret(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

function decryptSecret(stored) {
  if (!stored) return ''
  const [v, ivB64, tagB64, dataB64] = String(stored).split(':')
  if (v !== 'v1' || !ivB64 || !tagB64 || !dataB64) return ''
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
      'utf8'
    )
  } catch {
    return ''
  }
}

function getStoredWebdav(userId) {
  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId)
  if (!row) return null
  return {
    server: row.webdav_server,
    username: row.webdav_username,
    password: decryptSecret(row.webdav_password),
    path: row.webdav_path || 'DevNotes',
  }
}

function getStoredWebdavPublic(userId) {
  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId)
  return {
    server: row?.webdav_server || '',
    username: row?.webdav_username || '',
    path: row?.webdav_path || 'DevNotes',
    hasPassword: !!row?.webdav_password,
  }
}

const davRoot = (cfg) => {
  let base = cfg.server.replace(/\/+$/, '')
  if (base.includes('/remote.php/dav/files/')) return base
  if (base.includes('/remote.php/dav')) return `${base}/files/${cfg.username}`
  return `${base}/remote.php/dav/files/${cfg.username}`
}
const makeWebdavClient = (cfg) =>
  createClient(davRoot(cfg), { username: cfg.username, password: cfg.password })

const sanitizeName = (s) =>
  s
    .split('')
    .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
    .join('')
    .replace(/[\\/:*?"<>|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function webdavConfigFrom(body, fallback = {}) {
  return {
    server: String(body.server ?? fallback.server ?? '').trim(),
    username: String(body.username ?? fallback.username ?? '').trim(),
    password: String(body.password ?? fallback.password ?? ''),
    path:
      String(body.path ?? fallback.path ?? 'DevNotes')
        .trim()
        .replace(/^\/+|\/+$/g, '') || 'DevNotes',
  }
}

// ---------- health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

// ---------- auth ----------
app.post('/api/auth/register', (_req, res) => {
  res.status(403).json({ error: 'Pendaftaran akun dinonaktifkan' })
})

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const password = String(req.body?.password ?? '')
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Password salah' })
  }
  res.json({
    token: signToken({ id: adminId, username: 'admin' }),
    user: { id: adminId, username: 'admin' },
  })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

// protect every other /api route
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next()
  return requireAuth(req, res, next)
})

// ---------- folders ----------
app.get('/api/folders', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY created_at ASC')
    .all(req.user.id)
  res.json(rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon || '', createdAt: r.created_at })))
})

app.post('/api/folders', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const icon = String(req.body?.icon ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi' })
  const row = {
    id: id(),
    name,
    icon,
    created_at: new Date().toISOString(),
    user_id: req.user.id,
  }
  db.prepare('INSERT INTO folders (id, name, icon, user_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
    row.id,
    row.name,
    row.icon,
    row.user_id,
    row.created_at
  )
  res.status(201).json({ id: row.id, name: row.name, icon: row.icon, createdAt: row.created_at })
})

app.put('/api/folders/:id', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const icon = String(req.body?.icon ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi' })
  const r = db
    .prepare('UPDATE folders SET name = ?, icon = ? WHERE id = ? AND user_id = ?')
    .run(name, icon, req.params.id, req.user.id)
  if (!r.changes) return res.status(404).json({ error: 'Folder tidak ditemukan' })
  res.json({
    id: req.params.id,
    name,
    icon,
    createdAt: db.prepare('SELECT created_at FROM folders WHERE id = ?').get(req.params.id).created_at,
  })
})

app.delete('/api/folders/:id', (req, res) => {
  db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---------- tags ----------
app.get('/api/tags', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC')
    .all(req.user.id)
  res.json(rows.map((r) => ({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at })))
})

app.post('/api/tags', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama tag wajib diisi' })
  const existing = db
    .prepare('SELECT * FROM tags WHERE name = ? AND user_id = ?')
    .get(name, req.user.id)
  if (existing) return res.status(409).json({ error: 'Tag sudah ada', tag: { id: existing.id, name: existing.name, color: existing.color } })
  const row = {
    id: id(),
    name,
    color: String(req.body?.color ?? '#38bdf8'),
    created_at: new Date().toISOString(),
    user_id: req.user.id,
  }
  db.prepare('INSERT INTO tags (id, name, color, user_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
    row.id,
    row.name,
    row.color,
    row.user_id,
    row.created_at
  )
  res.status(201).json({ id: row.id, name: row.name, color: row.color, createdAt: row.created_at })
})

app.put('/api/tags/:id', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const color = String(req.body?.color ?? '')
  const r = db
    .prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND user_id = ?')
    .run(name || null, color || null, req.params.id, req.user.id)
  if (!r.changes) return res.status(404).json({ error: 'Tag tidak ditemukan' })
  const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id)
  res.json({ id: row.id, name: row.name, color: row.color, createdAt: row.created_at })
})

app.delete('/api/tags/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---------- notes ----------
app.get('/api/notes', (req, res) => {
  const { search = '', folder = '', tag = '', sort = 'updated' } = req.query
  const notes = queryNotes({
    userId: req.user.id,
    search: String(search),
    folder: String(folder),
    tag: String(tag),
    sort: String(sort),
    limit: search ? 100 : null,
  })
  res.json(notes)
})

app.get('/api/notes/:id', (req, res) => {
  const note = getNoteById(req.params.id, req.user.id)
  if (!note) return res.status(404).json({ error: 'Catatan tidak ditemukan' })
  res.json(note)
})

app.post('/api/notes', (req, res) => {
  const b = parseNoteBody(req.body)
  b.folder_id = ownedFolderId(b.folder_id, req.user.id)
  const now = new Date().toISOString()
  const noteId = String(req.body?.id || id())
  db.prepare(
    'INSERT INTO notes (id, title, content, folder_id, pinned, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(noteId, b.title, b.content, b.folder_id, b.pinned, now, now, req.user.id)
  saveTags(noteId, req.body?.tags)
  res.status(201).json(getNoteById(noteId, req.user.id))
})

app.put('/api/notes/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Catatan tidak ditemukan' })
  const b = parseNoteBody(req.body, {
    title: existing.title,
    content: existing.content,
    folderId: existing.folder_id,
    pinned: existing.pinned,
  })
  b.folder_id = ownedFolderId(b.folder_id, req.user.id)
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE notes SET title = ?, content = ?, folder_id = ?, pinned = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(b.title, b.content, b.folder_id, b.pinned, now, req.params.id, req.user.id)
  if (Array.isArray(req.body?.tags)) saveTags(req.params.id, req.body.tags)
  res.json(getNoteById(req.params.id, req.user.id))
})

app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---------- attachments ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, crypto.randomUUID() + ext)
  },
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

app.post('/api/notes/:id/attachments', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File wajib diunggah' })
  const noteId = req.params.id
  if (!db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(noteId, req.user.id)) {
    fs.rmSync(req.file.path, { force: true })
    return res.status(404).json({ error: 'Catatan tidak ditemukan' })
  }
  const row = {
    id: id(),
    note_id: noteId,
    name: req.file.originalname,
    size: req.file.size,
    type: path.extname(req.file.originalname).slice(1).toLowerCase() || 'file',
    path: req.file.path,
    created_at: new Date().toISOString(),
  }
  db.prepare(
    'INSERT INTO attachments (id, note_id, name, size, type, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(row.id, row.note_id, row.name, row.size, row.type, row.path, row.created_at)
  res.status(201).json({ id: row.id, name: row.name, size: row.size, type: row.type })
})

function getAttachmentOwned(req, res) {
  const row = db
    .prepare(
      `SELECT a.*, n.user_id FROM attachments a JOIN notes n ON n.id = a.note_id WHERE a.id = ?`
    )
    .get(req.params.id)
  if (!row || row.user_id !== req.user.id) {
    res.status(404).json({ error: 'Lampiran tidak ditemukan' })
    return null
  }
  return row
}

app.delete('/api/attachments/:id', (req, res) => {
  const row = getAttachmentOwned(req, res)
  if (!row) return
  fs.rmSync(row.path, { force: true })
  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

const INLINE_IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp']

app.get('/api/attachments/:id/download', (req, res) => {
  const row = getAttachmentOwned(req, res)
  if (!row) return
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.download(row.path, row.name)
})

app.get('/api/attachments/:id/raw', (req, res) => {
  const row = getAttachmentOwned(req, res)
  if (!row) return
  const type = String(row.type || '').toLowerCase()
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (INLINE_IMAGE_TYPES.includes(type)) {
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'no-store')
  } else {
    res.setHeader('Content-Disposition', 'attachment')
  }
  res.sendFile(row.path)
})

// ---------- tasks board ----------
const DEFAULT_STATUS_COLORS = ['#8b5cf6', '#f59e0b', '#38bdf8', '#10b981', '#ec4899', '#64748b']

seedDefaultStatuses(adminId)

const rowToStatus = (r) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  position: r.position,
  createdAt: r.created_at,
})

const rowToTask = (r) => ({
  id: r.id,
  title: r.title,
  content: r.content,
  statusId: r.status_id,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

function seedDefaultStatuses(userId) {
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM task_statuses WHERE user_id = ?')
    .get(userId)
  if (count > 0) return
  const insert = db.prepare(
    'INSERT INTO task_statuses (id, name, color, position, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const defaults = ['To-do', 'In progress', 'In review', 'Complete']
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    defaults.forEach((name, i) => {
      insert.run(id(), name, DEFAULT_STATUS_COLORS[i % DEFAULT_STATUS_COLORS.length], i, userId, now)
    })
  })
  tx()
}

app.get('/api/tasks/board', (req, res) => {
  const columns = db
    .prepare('SELECT * FROM task_statuses WHERE user_id = ? ORDER BY position ASC, created_at ASC')
    .all(req.user.id)
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC, created_at ASC')
    .all(req.user.id)
  res.json({ columns: columns.map(rowToStatus), tasks: tasks.map(rowToTask) })
})

app.post('/api/task-statuses', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama kolom wajib diisi' })
  const { pos } = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM task_statuses WHERE user_id = ?')
    .get(req.user.id)
  const row = {
    id: id(),
    name,
    color: String(req.body?.color ?? DEFAULT_STATUS_COLORS[0]),
    position: pos,
    created_at: new Date().toISOString(),
    user_id: req.user.id,
  }
  db.prepare(
    'INSERT INTO task_statuses (id, name, color, position, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(row.id, row.name, row.color, row.position, row.user_id, row.created_at)
  res.status(201).json(rowToStatus(row))
})

app.post('/api/task-statuses/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  const upd = db.prepare(
    'UPDATE task_statuses SET position = ? WHERE id = ? AND user_id = ?'
  )
  const tx = db.transaction(() => {
    ids.forEach((cid, i) => upd.run(i, cid, req.user.id))
  })
  tx()
  res.json({ ok: true })
})

app.put('/api/task-statuses/:id', (req, res) => {
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined
  const color = req.body?.color !== undefined ? String(req.body.color) : undefined
  const r = db
    .prepare(
      'UPDATE task_statuses SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND user_id = ?'
    )
    .run(name || null, color || null, req.params.id, req.user.id)
  if (!r.changes) return res.status(404).json({ error: 'Kolom tidak ditemukan' })
  const row = db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(req.params.id)
  res.json(rowToStatus(row))
})

app.delete('/api/task-statuses/:id', (req, res) => {
  db.prepare('DELETE FROM task_statuses WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user.id
  )
  res.json({ ok: true })
})

app.post('/api/tasks', (req, res) => {
  const title = String(req.body?.title ?? '').trim()
  const statusId = String(req.body?.statusId ?? '')
  if (!title) return res.status(400).json({ error: 'Judul tugas wajib diisi' })
  const status = db
    .prepare('SELECT id FROM task_statuses WHERE id = ? AND user_id = ?')
    .get(statusId, req.user.id)
  if (!status) return res.status(404).json({ error: 'Kolom tidak ditemukan' })
  const { pos } = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE status_id = ?')
    .get(statusId)
  const now = new Date().toISOString()
  const row = {
    id: id(),
    title,
    content: String(req.body?.content ?? ''),
    status_id: statusId,
    position: pos,
    user_id: req.user.id,
    created_at: now,
    updated_at: now,
  }
  db.prepare(
    'INSERT INTO tasks (id, title, content, status_id, position, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(row.id, row.title, row.content, row.status_id, row.position, row.user_id, row.created_at, row.updated_at)
  res.status(201).json(rowToTask(row))
})

app.put('/api/tasks/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Tugas tidak ditemukan' })
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title
  const content = req.body?.content !== undefined ? String(req.body.content) : existing.content
  const now = new Date().toISOString()
  db.prepare('UPDATE tasks SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    title || existing.title,
    content,
    now,
    req.params.id,
    req.user.id
  )
  res.json(rowToTask({ ...existing, title, content, updated_at: now }))
})

app.post('/api/tasks/reorder', (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  const upd = db.prepare(
    'UPDATE tasks SET status_id = ?, position = ? WHERE id = ? AND user_id = ?'
  )
  const tx = db.transaction(() => {
    for (const it of items) {
      const t = db
        .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
        .get(it.id, req.user.id)
      if (!t) continue
      const statusId = it.statusId ?? t.status_id
      const status = db
        .prepare('SELECT id FROM task_statuses WHERE id = ? AND user_id = ?')
        .get(statusId, req.user.id)
      if (!status) continue
      upd.run(statusId, Number(it.position) || 0, it.id, req.user.id)
    }
  })
  tx()
  res.json({ ok: true })
})

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---------- settings ----------
app.get('/api/settings/nextcloud', (req, res) => {
  res.json(getStoredWebdavPublic(req.user.id))
})

app.put('/api/settings/nextcloud', (req, res) => {
  const cfg = webdavConfigFrom(req.body ?? {}, getStoredWebdav(req.user.id) ?? {})
  if (!cfg.server || !cfg.username) {
    return res.status(400).json({ error: 'Server dan username wajib diisi' })
  }
  const stored = getStoredWebdav(req.user.id)
  const password = cfg.password || stored?.password || ''
  db.prepare(
    `INSERT INTO settings (user_id, webdav_server, webdav_username, webdav_password, webdav_path, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       webdav_server = excluded.webdav_server,
       webdav_username = excluded.webdav_username,
       webdav_password = excluded.webdav_password,
       webdav_path = excluded.webdav_path,
       updated_at = excluded.updated_at`
  ).run(req.user.id, cfg.server, cfg.username, encryptSecret(password), cfg.path, new Date().toISOString())
  res.json(getStoredWebdavPublic(req.user.id))
})

// ---------- nextcloud test & sync ----------
app.post('/api/nextcloud/test', async (req, res) => {
  const stored = getStoredWebdav(req.user.id) ?? {}
  const cfg = webdavConfigFrom(req.body ?? {}, stored)
  if (!cfg.server || !cfg.username) {
    return res.status(400).json({ error: 'Server dan username wajib diisi' })
  }
  const password = cfg.password || stored.password || ''
  if (!password) return res.status(400).json({ error: 'Password wajib diisi' })
  try {
    const client = makeWebdavClient({ ...cfg, password })
    await client.getDirectoryContents('/')
    res.json({ ok: true, message: 'Koneksi WebDAV berhasil' })
  } catch (e) {
    res.status(502).json({ error: `Koneksi gagal: ${e.message}` })
  }
})

app.post('/api/nextcloud/sync', async (req, res) => {
  const stored = getStoredWebdav(req.user.id)
  if (!stored || !stored.server || !stored.username || !stored.password) {
    return res.status(400).json({ error: 'Konfigurasi WebDAV belum diatur. Buka halaman Pengaturan.' })
  }
  try {
    const client = makeWebdavClient(stored)
    const base = `/${stored.path}`
    await client.createDirectory(base, { recursive: true })

    const notes = queryNotes({
      userId: req.user.id,
      search: '',
      folder: '',
      tag: '',
      sort: 'title',
      limit: null,
    })
    const folderNames = new Map(
      db
        .prepare('SELECT id, name FROM folders WHERE user_id = ?')
        .all(req.user.id)
        .map((f) => [f.id, f.name])
    )

    // Path tujuan tiap catatan: <base>/[<Folder>/]<judul>.md (deterministik + anti-bentrok).
    const desiredByNote = new Map()
    const desiredDirs = new Set([base])
    const used = new Map()
    for (const note of notes) {
      const folderName = note.folderId ? sanitizeName(folderNames.get(note.folderId) || '') : ''
      const dir = folderName ? `${base}/${folderName}` : base
      desiredDirs.add(dir)
      let name = (sanitizeName(note.title) || 'catatan').slice(0, 80)
      const key = `${dir.toLowerCase()}\u0000${name.toLowerCase()}`
      if (used.has(key)) {
        const n = used.get(key) + 1
        used.set(key, n)
        name = `${name} (${n})`
      } else {
        used.set(key, 0)
      }
      desiredByNote.set(note.id, `${dir}/${name}.md`)
    }

    const syncedMap = new Map(
      db
        .prepare('SELECT note_id, remote_path, synced_at FROM note_sync WHERE user_id = ?')
        .all(req.user.id)
        .map((r) => [r.note_id, r])
    )
    const upsertSync = db.prepare(
      `INSERT INTO note_sync (note_id, user_id, remote_path, synced_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(note_id) DO UPDATE SET remote_path = excluded.remote_path, synced_at = excluded.synced_at`
    )
    const dropSync = db.prepare('DELETE FROM note_sync WHERE note_id = ?')

    let uploaded = 0
    let moved = 0
    let skipped = 0
    let deleted = 0
    const failed = []

    // ---- catatan: unggah isi baru, pindahkan saat judul/folder berubah ----
    for (const note of notes) {
      const desired = desiredByNote.get(note.id)
      if (!desired) continue
      const dir = desired.slice(0, desired.lastIndexOf('/'))
      const prev = syncedMap.get(note.id)
      const samePlace = prev?.remote_path === desired
      if (samePlace && prev.synced_at >= note.updatedAt) {
        skipped++
        continue
      }
      try {
        await client.createDirectory(dir, { recursive: true })
        let didMove = false
        if (prev?.remote_path && !samePlace) {
          try {
            await client.moveFile(prev.remote_path, desired, { overwrite: true })
            didMove = true
          } catch {
            // file lama tidak ada di remote -> cukup unggah ulang di bawah
          }
        }
        await client.putFileContents(desired, note.content, { overwrite: true, contentLength: false })
        upsertSync.run(note.id, req.user.id, desired, note.updatedAt)
        if (didMove) moved++
        else uploaded++
      } catch (e) {
        failed.push({ title: note.title, error: e.message })
      }
    }

    // ---- catatan yang sudah dihapus: hapus file remote-nya ----
    const liveIds = new Set(notes.map((n) => n.id))
    for (const [noteId, row] of syncedMap) {
      if (liveIds.has(noteId)) continue
      try {
        if (row.remote_path) await client.deleteFile(row.remote_path)
        dropSync.run(noteId)
        deleted++
      } catch (e) {
        failed.push({ title: row.remote_path || noteId, error: e.message })
      }
    }

    // ---- lampiran: unggah ke <base>/_attachments/<note-id>/<nama-file> ----
    const attRows = db
      .prepare(
        `SELECT a.* FROM attachments a JOIN notes n ON n.id = a.note_id WHERE n.user_id = ?`
      )
      .all(req.user.id)
    const desiredAtt = new Map()
    const desiredAttDirs = new Set()
    for (const a of attRows) {
      const dir = `${base}/_attachments/${a.note_id}`
      desiredAttDirs.add(dir)
      desiredAtt.set(a.id, `${dir}/${sanitizeName(a.name) || 'file'}`)
    }
    const attSyncedMap = new Map(
      db
        .prepare('SELECT attachment_id, remote_path FROM attachment_sync WHERE user_id = ?')
        .all(req.user.id)
        .map((r) => [r.attachment_id, r.remote_path])
    )
    const upsertAtt = db.prepare(
      `INSERT INTO attachment_sync (attachment_id, user_id, remote_path, synced_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(attachment_id) DO UPDATE SET remote_path = excluded.remote_path, synced_at = excluded.synced_at`
    )
    const dropAtt = db.prepare('DELETE FROM attachment_sync WHERE attachment_id = ?')

    let attachments = 0
    for (const a of attRows) {
      const desired = desiredAtt.get(a.id)
      if (attSyncedMap.get(a.id) === desired) continue // lampiran tidak berubah
      if (!fs.existsSync(a.path)) continue
      try {
        await client.createDirectory(desired.slice(0, desired.lastIndexOf('/')), { recursive: true })
        await client.putFileContents(desired, fs.readFileSync(a.path), {
          overwrite: true,
          contentLength: false,
        })
        upsertAtt.run(a.id, req.user.id, desired, new Date().toISOString())
        attachments++
      } catch (e) {
        failed.push({ title: a.name, error: e.message })
      }
    }

    // ---- lampiran yang sudah dihapus: hapus file remote-nya ----
    const liveAtt = new Set(attRows.map((a) => a.id))
    const staleAttDirs = new Set()
    for (const [attId, remotePath] of attSyncedMap) {
      if (liveAtt.has(attId)) continue
      try {
        await client.deleteFile(remotePath)
        dropAtt.run(attId)
        deleted++
        staleAttDirs.add(remotePath.slice(0, remotePath.lastIndexOf('/')))
      } catch (e) {
        failed.push({ title: remotePath, error: e.message })
      }
    }

    // ---- bersihkan folder lama yang kini kosong (hanya di bawah base) ----
    const oldDirs = new Set(staleAttDirs)
    for (const [, row] of syncedMap) {
      if (!row.remote_path) continue
      const d = row.remote_path.slice(0, row.remote_path.lastIndexOf('/'))
      if (d && d !== base && !desiredDirs.has(d)) oldDirs.add(d)
    }
    for (const dir of oldDirs) {
      try {
        const items = await client.getDirectoryContents(dir)
        if (Array.isArray(items) && items.length === 0) await client.deleteFile(dir)
      } catch {
        // abaikan kegagalan pembersihan folder
      }
    }

    const changed = uploaded + moved + deleted + attachments
    const parts = [`${uploaded} diunggah`]
    if (moved) parts.push(`${moved} dipindah`)
    if (deleted) parts.push(`${deleted} dihapus`)
    if (attachments) parts.push(`${attachments} lampiran`)
    res.json({
      ok: true,
      uploaded,
      moved,
      deleted,
      attachments,
      skipped,
      failed,
      path: base,
      message: changed ? `Sinkron selesai: ${parts.join(', ')}` : 'Semua catatan sudah sinkron',
    })
  } catch (e) {
    res.status(502).json({ error: `Sinkronisasi gagal: ${e.message}` })
  }
})

// ---------- production static ----------
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((err, _req, res, _next) => {
  console.error(err)
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran file terlalu besar (maks 20 MB)' })
  }
  // Jangan bocorkan detail internal (path/stack/SQL) ke client.
  res.status(500).json({ error: 'Terjadi kesalahan pada server' })
})

app.listen(PORT, () => {
  console.log(`DevNotes API running on http://localhost:${PORT}`)
  console.log(`SQLite database: ${db.name} | uploads: ${UPLOAD_DIR}`)
  if (!process.env.ADMIN_PASSWORD) {
    console.log('ADMIN_PASSWORD tidak diset -> memakai password default "admin123". Ubah dengan env ADMIN_PASSWORD.')
  }
})