const BASE = '/api'

let token = null
let unauthorizedHandler = null

export function setToken(t) {
  token = t
}

export function getToken() {
  return token
}

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { ...options, headers })
  if (res.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler?.()
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.error || message
    } catch {
      /* not json */
    }
    throw new Error(message)
  }
  return res.json()
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function authedImageUrl(src) {
  if (typeof src !== 'string' || !src.startsWith(BASE + '/attachments')) return src
  const t = getToken()
  return `${src}${src.includes('?') ? '&' : '?'}token=${encodeURIComponent(t || '')}`
}

export const api = {
  health: () => req('/health'),

  login: (password) => req('/auth/login', json('POST', { password })),
  register: (username, password) => req('/auth/register', json('POST', { username, password })),
  me: () => req('/auth/me'),

  getFolders: () => req('/folders'),
  createFolder: (name, icon = '') => req('/folders', json('POST', { name, icon })),
  updateFolder: (id, data) =>
    req(`/folders/${id}`, json('PUT', { name: data.name, icon: data.icon || '' })),
  deleteFolder: (id) => req(`/folders/${id}`, { method: 'DELETE' }),

  getTags: () => req('/tags'),
  createTag: (name, color) => req('/tags', json('POST', { name, color })),
  deleteTag: (id) => req(`/tags/${id}`, { method: 'DELETE' }),

  getNotes: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v)
    }
    const s = qs.toString()
    return req(`/notes${s ? `?${s}` : ''}`)
  },
  getNote: (id) => req(`/notes/${id}`),
  createNote: (note) => req('/notes', json('POST', note)),
  updateNote: (id, note) => req(`/notes/${id}`, json('PUT', note)),
  deleteNote: (id) => req(`/notes/${id}`, { method: 'DELETE' }),

  uploadAttachment: (noteId, file) => {
    const form = new FormData()
    form.append('file', file)
    return req(`/notes/${noteId}/attachments`, { method: 'POST', body: form })
  },
  deleteAttachment: (id) => req(`/attachments/${id}`, { method: 'DELETE' }),
  attachmentUrl: (id) => {
    const t = getToken()
    return `${BASE}/attachments/${id}/download${t ? `?token=${encodeURIComponent(t)}` : ''}`
  },
  attachmentRaw: (id) => `${BASE}/attachments/${id}/raw`,

  getNextcloudSettings: () => req('/settings/nextcloud'),
  saveNextcloudSettings: (cfg) => req('/settings/nextcloud', json('PUT', cfg)),
  testNextcloud: (cfg) => req('/nextcloud/test', json('POST', cfg)),
  syncNextcloud: () => req('/nextcloud/sync', { method: 'POST' }),
}