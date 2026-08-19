import express from 'express'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { db, seedAdmin, seedIfEmpty, rowToNote, buildSnippet, ftsMatch } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4000
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')
const JWT_SECRET = process.env.JWT_SECRET || 'devnotes-dev-secret-change-me'
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '10mb' }))

const adminId = seedAdmin()
seedIfEmpty(adminId)

// ---------- helpers ----------
const id = () => crypto.randomUUID()

const signToken = (user) =>
  jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' })
  }
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
  SELECT n.rowid, n.id, n.title, n.content, n.folder_id, n.pinned, n.sensitive,
         n.created_at, n.updated_at
  FROM notes n
`

function queryNotes({ userId, search, folder, tag, sort, limit }) {
  const where = ['n.user_id = ?']
  const params = [userId]

  if (search) {
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
    sensitive: body.sensitive !== undefined ? (body.sensitive ? 1 : 0) : existing.sensitive ? 1 : 0,
  }
}

// ---------- health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

// ---------- auth ----------
function validateCredentials(username, password) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return 'Username 3-20 karakter (huruf, angka, underscore)'
  }
  if (password.length < 6) return 'Password minimal 6 karakter'
  return null
}

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const invalid = validateCredentials(username, password)
  if (invalid) return res.status(400).json({ error: invalid })
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Username sudah dipakai' })
  }
  const userId = id()
  const hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    userId,
    username,
    hash,
    new Date().toISOString()
  )
  seedIfEmpty(userId)
  res.status(201).json({ token: signToken({ id: userId, username }), user: { id: userId, username } })
})

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' })
  }
  res.json({
    token: signToken({ id: row.id, username: row.username }),
    user: { id: row.id, username: row.username },
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
  res.json(rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })))
})

app.post('/api/folders', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi' })
  const row = {
    id: id(),
    name,
    created_at: new Date().toISOString(),
    user_id: req.user.id,
  }
  db.prepare('INSERT INTO folders (id, name, user_id, created_at) VALUES (?, ?, ?, ?)').run(
    row.id,
    row.name,
    row.user_id,
    row.created_at
  )
  res.status(201).json({ id: row.id, name: row.name, createdAt: row.created_at })
})

app.put('/api/folders/:id', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi' })
  const r = db
    .prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?')
    .run(name, req.params.id, req.user.id)
  if (!r.changes) return res.status(404).json({ error: 'Folder tidak ditemukan' })
  res.json({ id: req.params.id, name, createdAt: db.prepare('SELECT created_at FROM folders WHERE id = ?').get(req.params.id).created_at })
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
  const now = new Date().toISOString()
  const noteId = String(req.body?.id || id())
  db.prepare(
    'INSERT INTO notes (id, title, content, folder_id, pinned, sensitive, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(noteId, b.title, b.content, b.folder_id, b.pinned, b.sensitive, now, now, req.user.id)
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
    sensitive: existing.sensitive,
  })
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE notes SET title = ?, content = ?, folder_id = ?, pinned = ?, sensitive = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(b.title, b.content, b.folder_id, b.pinned, b.sensitive, now, req.params.id, req.user.id)
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

app.get('/api/attachments/:id/download', (req, res) => {
  const row = getAttachmentOwned(req, res)
  if (!row) return
  res.download(row.path, row.name)
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
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`DevNotes API running on http://localhost:${PORT}`)
  console.log(`SQLite database: ${db.name} | uploads: ${UPLOAD_DIR}`)
})