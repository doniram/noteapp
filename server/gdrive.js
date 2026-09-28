import { google } from 'googleapis'
import path from 'node:path'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const guessMime = (name) => {
  const ext = path.extname(name).slice(1).toLowerCase()
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    zip: 'application/zip',
    yml: 'text/yaml',
    yaml: 'text/yaml',
    sh: 'text/x-shellscript',
  }
  return map[ext] || 'application/octet-stream'
}

const escapeQ = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// Bangun OAuth client dari kredensial tersimpan.
export function makeOAuthClient({ clientId, clientSecret, redirectUri, refreshToken }) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri || 'http://localhost')
  if (refreshToken) auth.setCredentials({ refresh_token: refreshToken })
  return auth
}

export function buildAuthUrl({ clientId, clientSecret, redirectUri, state }) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_SCOPE],
    state,
  })
}

export async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const { tokens } = await auth.getToken(code)
  return tokens
}

export async function getDriveAccount({ clientId, clientSecret, refreshToken }) {
  const auth = makeOAuthClient({ clientId, clientSecret, refreshToken })
  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.about.get({ fields: 'user(emailAddress,displayName)' })
  return res.data?.user?.emailAddress || ''
}

/**
 * Adapter Google Drive dengan antarmuka berbasis path relatif terhadap folder
 * tujuan (sama seperti adapter WebDAV), supaya mesin rekonsiliasi bisa dipakai
 * bersama. `root` boleh berupa nama folder di My Drive, atau ID/URL folder.
 */
export function createDriveAdapter({ clientId, clientSecret, refreshToken, root }) {
  const auth = makeOAuthClient({ clientId, clientSecret, refreshToken })
  const drive = google.drive({ version: 'v3', auth })
  const cache = new Map() // key -> id (folder) / id|null (file)
  let rootId = null

  const listParams = {
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }

  async function findChild(parentId, name, wantFolder) {
    const key = `${parentId}\u0000${name}\u0000${wantFolder ? 1 : 0}`
    if (cache.has(key)) return cache.get(key)
    const q = [
      `'${escapeQ(parentId)}' in parents`,
      `name = '${escapeQ(name)}'`,
      'trashed = false',
      wantFolder ? `mimeType = '${FOLDER_MIME}'` : `mimeType != '${FOLDER_MIME}'`,
    ].join(' and ')
    const res = await drive.files.list({
      ...listParams,
      q,
      fields: 'files(id,name)',
      pageSize: 1,
    })
    const id = res.data?.files?.[0]?.id || null
    cache.set(key, id)
    return id
  }

  async function createFolder(parentId, name) {
    const res = await drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id',
      supportsAllDrives: true,
    })
    const id = res.data.id
    cache.set(`${parentId}\u0000${name}\u00001`, id)
    return id
  }

  async function ensureFolder(parentId, name) {
    return (await findChild(parentId, name, true)) || createFolder(parentId, name)
  }

  function explicitFolderId(value) {
    const m = value.match(/\/folders\/([A-Za-z0-9_-]+)/) || value.match(/[?&]id=([A-Za-z0-9_-]+)/)
    if (m) return m[1]
    return /^[A-Za-z0-9_-]{20,}$/.test(value) ? value : null
  }

  async function resolveRoot() {
    if (rootId) return rootId
    const value = String(root || '').trim()
    const id = explicitFolderId(value)
    if (id) {
      rootId = id
      return rootId
    }
    rootId = await ensureFolder('root', value || 'DevNotes')
    return rootId
  }

  const splitRel = (rel) => String(rel || '').split('/').filter(Boolean)

  async function resolveDir(rel) {
    let id = await resolveRoot()
    for (const part of splitRel(rel)) id = await ensureFolder(id, part)
    return id
  }

  async function findDir(rel) {
    let id = await resolveRoot()
    for (const part of splitRel(rel)) {
      id = await findChild(id, part, true)
      if (!id) return null
    }
    return id
  }

  async function resolveParent(relFile) {
    const idx = String(relFile).lastIndexOf('/')
    if (idx === -1) return resolveRoot()
    return resolveDir(String(relFile).slice(0, idx))
  }

  const baseName = (p) => String(p).slice(String(p).lastIndexOf('/') + 1)

  return {
    type: 'gdrive',

    async ensureDir(rel) {
      await resolveDir(rel)
    },

    // Path Drive selalu relatif; normalisasi sisa leading slash bila ada.
    toRelative(p) {
      return String(p || '').replace(/^\/+/, '')
    },

    async putFile(rel, data, mime) {
      const parentId = await resolveParent(rel)
      const name = baseName(rel)
      const mimeType = mime || guessMime(name)
      const existingId = await findChild(parentId, name, false)
      if (existingId) {
        await drive.files.update({
          fileId: existingId,
          media: { mimeType, body: data },
          fields: 'id',
          supportsAllDrives: true,
        })
        return { id: existingId }
      }
      const res = await drive.files.create({
        requestBody: { name, parents: [parentId] },
        media: { mimeType, body: data },
        fields: 'id',
        supportsAllDrives: true,
      })
      const id = res.data.id
      cache.set(`${parentId}\u0000${name}\u00000`, id)
      return { id }
    },

    async moveFile(fromRel, toRel, fromId) {
      const fileId = fromId || (await findChild(await resolveParent(fromRel), baseName(fromRel), false))
      if (!fileId) return {}
      const toParent = await resolveParent(toRel)
      const fromParent = await resolveParent(fromRel)
      await drive.files.update({
        fileId,
        addParents: toParent,
        ...(fromParent && fromParent !== toParent ? { removeParents: fromParent } : {}),
        requestBody: { name: baseName(toRel) },
        fields: 'id',
        supportsAllDrives: true,
      })
      return { id: fileId }
    },

    async deleteFile(rel, id) {
      const fileId = id || (await findChild(await resolveParent(rel), baseName(rel), false))
      if (!fileId) return
      await drive.files.delete({ fileId, supportsAllDrives: true })
    },

    async deleteDir(rel) {
      if (!rel) return
      const id = await findDir(rel)
      if (!id) return
      await drive.files.delete({ fileId: id, supportsAllDrives: true })
    },

    async dirIsEmpty(rel) {
      const id = await findDir(rel)
      if (!id) return true
      const res = await drive.files.list({
        ...listParams,
        q: `'${escapeQ(id)}' in parents and trashed = false`,
        fields: 'files(id)',
        pageSize: 1,
      })
      return (res.data?.files || []).length === 0
    },

    async test() {
      return getDriveAccount({ clientId, clientSecret, refreshToken })
    },
  }
}
