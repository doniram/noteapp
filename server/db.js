import Database from 'better-sqlite3'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { seedFolders, seedTags, seedNotes } from '../src/data/seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'devnotes.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notes (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  webdav_server TEXT NOT NULL DEFAULT '',
  webdav_username TEXT NOT NULL DEFAULT '',
  webdav_password TEXT NOT NULL DEFAULT '',
  webdav_path TEXT NOT NULL DEFAULT 'DevNotes',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_sync (
  note_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  synced_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, content,
  content='notes',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
`)

// ---- migrations for existing databases ----
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
  }
}
ensureColumn('folders', 'user_id', "TEXT NOT NULL DEFAULT ''")
ensureColumn('folders', 'icon', "TEXT NOT NULL DEFAULT ''")
ensureColumn('tags', 'user_id', "TEXT NOT NULL DEFAULT ''")
ensureColumn('notes', 'user_id', "TEXT NOT NULL DEFAULT ''")
// tag name uniqueness must be per-user, not global -> rebuild tags table if it still
// carries the old inline UNIQUE(name) constraint (its autoindex cannot be dropped)
const hasOldTagIndex = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'sqlite_autoindex_tags_1'`)
  .get()
if (hasOldTagIndex) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE tags_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO tags_new SELECT id, name, color, created_at, user_id FROM tags;
    DROP TABLE tags;
    ALTER TABLE tags_new RENAME TO tags;
    PRAGMA foreign_keys = ON;
  `)
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS tags_user_name ON tags(user_id, name)')

// ---- auth seed ----
export function seedAdmin() {
  const first = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get()
  if (first) return first.id

  const id = crypto.randomUUID()
  const hash = bcrypt.hashSync('admin123', 10)
  const now = new Date().toISOString()
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    'admin',
    hash,
    now
  )
  // adopt rows that predate per-user columns
  db.prepare("UPDATE folders SET user_id = ? WHERE user_id = ''").run(id)
  db.prepare("UPDATE tags SET user_id = ? WHERE user_id = ''").run(id)
  db.prepare("UPDATE notes SET user_id = ? WHERE user_id = ''").run(id)
  return id
}

export function seedIfEmpty(userId) {
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM notes WHERE user_id = ?')
    .get(userId)
  if (count > 0) return

  const insertFolder = db.prepare(
    'INSERT INTO folders (id, name, user_id, created_at) VALUES (?, ?, ?, ?)'
  )
  const insertTag = db.prepare(
    'INSERT INTO tags (id, name, color, user_id, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const insertNote = db.prepare(
    'INSERT INTO notes (id, title, content, folder_id, pinned, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertNoteTag = db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')

  const fmap = new Map()
  const tmap = new Map()

  const tx = db.transaction(() => {
    for (const f of seedFolders) {
      const nid = crypto.randomUUID()
      fmap.set(f.id, nid)
      insertFolder.run(nid, f.name, userId, seedNow())
    }
    for (const t of seedTags) {
      const nid = crypto.randomUUID()
      tmap.set(t.id, nid)
      insertTag.run(nid, t.name, t.color, userId, seedNow())
    }
    for (const n of seedNotes) {
      const nid = crypto.randomUUID()
      insertNote.run(
        nid,
        n.title,
        n.content,
        n.folderId ? fmap.get(n.folderId) : null,
        n.pinned ? 1 : 0,
        n.createdAt,
        n.updatedAt,
        userId
      )
      for (const tid of n.tags) insertNoteTag.run(nid, tmap.get(tid))
    }
  })
  tx()
}

function seedNow() {
  return new Date().toISOString()
}

{
  const noteSecret = process.env.JWT_SECRET || 'devnotes-dev-secret-change-me'
  const key = crypto.createHash('sha256').update(`${noteSecret}:notes`).digest()
  const encPrefix = 'ENCV1:'
  const dec = (stored) => {
    if (typeof stored !== 'string' || !stored.startsWith(encPrefix)) return stored
    const parts = stored.slice(encPrefix.length).split(':')
    if (parts.length !== 3) return stored
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64'))
      d.setAuthTag(Buffer.from(parts[1], 'base64'))
      return Buffer.concat([d.update(Buffer.from(parts[2], 'base64')), d.final()]).toString('utf8')
    } catch {
      return stored
    }
  }
  const enc = db
    .prepare("SELECT rowid, title, content FROM notes WHERE title LIKE 'ENCV1:%' OR content LIKE 'ENCV1:%'")
    .all()
  const decTx = db.transaction(() => {
    const upd = db.prepare('UPDATE notes SET title = ?, content = ? WHERE rowid = ?')
    for (const r of enc) upd.run(dec(r.title), dec(r.content), r.rowid)
  })
  decTx()
  const hasSensitive = db
    .prepare('PRAGMA table_info(notes)')
    .all()
    .some((c) => c.name === 'sensitive')
  if (hasSensitive) db.exec('ALTER TABLE notes DROP COLUMN sensitive')
}

export function rowToNote(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folder_id ?? null,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~|[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSnippet(content, query, maxLen = 140) {
  const text = stripMarkdown(content)
  const terms = (query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return text.slice(0, maxLen)
  const lower = text.toLowerCase()
  let idx = -1
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i !== -1 && (idx === -1 || i < idx)) idx = i
  }
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const slice = text.slice(start, start + maxLen)
  return (start > 0 ? '…' : '') + slice + (start + maxLen < text.length ? '…' : '')
}

export function ftsMatch(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/["']/g, '')}"*`)
    .join(' AND ')
}