import { createContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, setToken, setUnauthorizedHandler } from '../api'
import { uid } from '../lib/utils.jsx'
import { translate } from '../i18n'

const AppContext = createContext(null)

const SESSION_IDLE_MINUTES = Number(import.meta.env.VITE_SESSION_IDLE_MINUTES || 15)
const SESSION_WARN_SECONDS = 30
// Kunci layar setelah sekian detik tanpa aktivitas (0 = nonaktif).
const LOCK_IDLE_SECONDS = Number(import.meta.env.VITE_LOCK_IDLE_SECONDS ?? 60)
const LOCK_ENABLED = LOCK_IDLE_SECONDS > 0

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(
    () => !!localStorage.getItem('devnotes-token')
  )
  const [notes, setNotes] = useState([])
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const [activeId, setActiveId] = useState(null)
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState(null) // null all, 'pinned', 'none', or folder id
  const [activeTag, setActiveTag] = useState(null)
  const [sort, setSort] = useState('updated')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [folderModalTarget, setFolderModalTarget] = useState(null)
  const [folderToDelete, setFolderToDelete] = useState(null)
  const [tagModal, setTagModal] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)
  const [listWidth, setListWidth] = useState(384)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [nextcloud, setNextcloud] = useState(null)
  const [gdrive, setGdrive] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [providerSyncing, setProviderSyncing] = useState(null) // 'webdav' | 'gdrive' | null
  const [nextcloudSyncResult, setNextcloudSyncResult] = useState(null)
  const [gdriveSyncResult, setGdriveSyncResult] = useState(null)
  const [notice, setNotice] = useState(null)
  const [view, setView] = useState('notes') // 'notes' | 'tasks'
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('devnotes-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('devnotes-lang') || 'id'
    } catch {
      return 'id'
    }
  })
  const t = useMemo(() => (key, vars) => translate(lang, key, vars), [lang])

  const [sessionExpiring, setSessionExpiring] = useState(false)
  const [sessionCountdown, setSessionCountdown] = useState(SESSION_WARN_SECONDS)
  const [locked, setLocked] = useState(false)
  const markActiveRef = useRef(null)

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  const changeLang = (l) => {
    setLang(l)
    try {
      localStorage.setItem('devnotes-lang', l)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // restore session from stored token
  useEffect(() => {
    const stored = localStorage.getItem('devnotes-token')
    if (!stored) return
    setToken(stored)
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem('devnotes-token')
        setToken(null)
      })
      .finally(() => setAuthLoading(false))
  }, [])

  // when any API call hits 401, force logout
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem('devnotes-token')
      setToken(null)
      setUser(null)
      setLocked(false)
    })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    try {
      localStorage.setItem('devnotes-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  // Penanda catatan yang punya editan lokal belum tersimpan, dipakai agar
  // refetch daftar dari server tidak menimpa isi yang masih diketik.
  const pendingSave = useRef({})
  const savingIds = useRef(new Set())
  const noteRev = useRef({})

  // ----- base data -----
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [f, t, cfg, gd] = await Promise.all([
          api.getFolders(),
          api.getTags(),
          api.getNextcloudSettings(),
          api.getGdriveSettings(),
        ])
        setFolders(f)
        setTags(t)
        setNextcloud(cfg)
        setGdrive(gd)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  // Hasil redirect OAuth Google Drive (?gdrive=connected|error).
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('gdrive')
    if (!status) return
    params.delete('gdrive')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    if (status === 'connected') {
      setNotice({ ok: true, text: translate(lang, 'settings.gdriveConnected') })
      api.getGdriveSettings().then(setGdrive).catch(() => {})
    } else {
      setNotice({ ok: false, text: translate(lang, 'settings.gdriveConnectError') })
    }
    // sengaja hanya bergantung pada user; status query sudah dihapus dari URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ----- list results on search/filter/sort change -----
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        setSearching(true)
        const list = await api.getNotes({
          search: search.trim() || undefined,
          folder: activeFolder || undefined,
          tag: activeTag || undefined,
          sort,
        })
        if (!cancelled) {
          setResults(list)
          setNotes((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]))
            for (const n of list) {
              // Jangan timpa catatan yang masih punya editan lokal belum tersimpan.
              if (savingIds.current.has(n.id)) continue
              map.set(n.id, n)
            }
            return [...map.values()]
          })
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, search.trim() ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [user, search, activeFolder, activeTag, sort])

  const activeNote = useMemo(() => {
    if (!activeId) return null
    return notes.find((n) => n.id === activeId) ?? results.find((n) => n.id === activeId) ?? null
  }, [activeId, notes, results])

  // ----- CRUD -----
  // Terapkan patch ke catatan di daftar & hasil pencarian sekaligus.
  const patchNoteLocal = (id, patch) => {
    const apply = (list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n))
    setNotes(apply)
    setResults(apply)
  }

  const updateNote = (id, patch) => {
    patchNoteLocal(id, { ...patch, updatedAt: new Date().toISOString() })
    // Tandai revisi: respons autosave hanya boleh menimpa state bila tidak ada
    // editan lokal yang lebih baru, supaya kursor tidak lompat ke akhir teks.
    noteRev.current[id] = (noteRev.current[id] || 0) + 1
    const rev = noteRev.current[id]
    savingIds.current.add(id)

    clearTimeout(pendingSave.current[id])
    pendingSave.current[id] = setTimeout(async () => {
      const full = notesRef.current.find((n) => n.id === id)
      if (!full) {
        savingIds.current.delete(id)
        return
      }
      try {
        const saved = await api.updateNote(id, full)
        if (noteRev.current[id] !== rev) return // ada editan lebih baru; biarkan save berikutnya
        patchNoteLocal(id, saved)
        savingIds.current.delete(id)
        delete pendingSave.current[id]
      } catch (e) {
        if (noteRev.current[id] === rev) {
          setError(e.message)
          savingIds.current.delete(id)
          delete pendingSave.current[id]
        }
      }
    }, 700)
  }

  const createNote = async (overrides = {}) => {
    const folderDefault =
      activeFolder && activeFolder !== 'pinned' && activeFolder !== 'none' ? activeFolder : null
    const temp = {
      id: uid(),
      title: 'Catatan Baru',
      content: '',
      folderId: folderDefault,
      tags: [],
      pinned: false,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
    setNotes((prev) => [temp, ...prev])
    setResults((prev) => [temp, ...prev])
    setActiveId(temp.id)
    noteRev.current[temp.id] = 0
    try {
      const saved = await api.createNote(temp)
      // Kalau pengguna sudah mulai mengetik sebelum request selesai, jangan
      // timpa isinya dengan respons create (nanti diselamatkan oleh autosave).
      if (noteRev.current[temp.id] === 0) patchNoteLocal(temp.id, saved)
      return saved
    } catch (e) {
      setError(e.message)
      return temp
    }
  }

  const createNoteFromTemplate = async (tpl) => {
    const note = await createNote({
      title: tpl.name,
      content: tpl.content,
      tags: [tags[0]?.id].filter(Boolean),
    })
    setTplOpen(false)
    return note
  }

  const importMarkdown = async (title, content) => {
    const note = await createNote({ title, content })
    setTplOpen(false)
    return note
  }

  const deleteNote = async (id) => {
    clearTimeout(pendingSave.current[id])
    delete pendingSave.current[id]
    delete noteRev.current[id]
    savingIds.current.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setResults((prev) => prev.filter((n) => n.id !== id))
    if (activeId === id) setActiveId(null)
    try {
      await api.deleteNote(id)
    } catch (e) {
      setError(e.message)
    }
  }

  const createFolder = async (name, icon = '') => {
    setFolderModal(false)
    setFolderModalTarget(null)
    try {
      const folder = await api.createFolder(name, icon)
      setFolders((prev) => [...prev, folder])
      setActiveFolder(folder.id)
      return folder
    } catch (e) {
      setError(e.message)
    }
  }

  const updateFolder = async (id, data) => {
    setFolderModal(false)
    setFolderModalTarget(null)
    try {
      const folder = await api.updateFolder(id, data)
      setFolders((prev) => prev.map((f) => (f.id === id ? folder : f)))
      return folder
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteFolder = async (id) => {
    setFolderToDelete(null)
    try {
      await api.deleteFolder(id)
      setFolders((prev) => prev.filter((f) => f.id !== id))
      setNotes((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)))
      setResults((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)))
      if (activeFolder === id) {
        setActiveFolder(null)
        setActiveTag(null)
        setActiveId(null)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const createTag = async (name, color) => {
    setTagModal(false)
    try {
      const tag = await api.createTag(name, color)
      setTags((prev) => [...prev, tag])
      return tag.id
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  const addAttachment = async (noteId, file) => {
    try {
      const att = await api.uploadAttachment(noteId, file)
      const updated = await api.getNote(noteId)
      // Hanya perbarui lampiran; jangan ganti seluruh note agar editan teks
      // yang belum tersimpan tidak tertimpa (kursor tetap di tempat).
      patchNoteLocal(noteId, { attachments: updated.attachments })
      return att
    } catch (e) {
      setError(e.message)
    }
  }

  const removeAttachment = async (noteId, attId) => {
    try {
      await api.deleteAttachment(attId)
      const updated = await api.getNote(noteId)
      patchNoteLocal(noteId, { attachments: updated.attachments })
    } catch (e) {
      setError(e.message)
    }
  }

  // ----- auth -----
  const login = async (password) => {
    const res = await api.login(password)
    localStorage.setItem('devnotes-token', res.token)
    setToken(res.token)
    setUser(res.user)
    setLocked(false)
  }

  const register = async (username, password) => {
    const res = await api.register(username, password)
    localStorage.setItem('devnotes-token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    for (const t of Object.values(pendingSave.current)) clearTimeout(t)
    pendingSave.current = {}
    savingIds.current.clear()
    noteRev.current = {}
    localStorage.removeItem('devnotes-token')
    setToken(null)
    setUser(null)
    setNotes([])
    setFolders([])
    setTags([])
    setResults([])
    setActiveId(null)
    setActiveFolder(null)
    setActiveTag(null)
    setSearch('')
    setSearching(false)
    setError(null)
    setLoading(true)
    setSessionExpiring(false)
    setSessionCountdown(SESSION_WARN_SECONDS)
    setLocked(false)
    setView('notes')
  }

  // ----- auto logout saat tidak ada aktivitas (idle timeout) -----
  useEffect(() => {
    if (!user) {
      markActiveRef.current = null
      return undefined
    }
    const IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000
    const LOCK_IDLE_MS = LOCK_IDLE_SECONDS * 1000
    let lastActivity = Date.now()
    let checkTimer = null
    let countdownTimer = null
    let expiring = false

    const stopCountdown = () => {
      clearInterval(countdownTimer)
      countdownTimer = null
      setSessionExpiring(false)
      setSessionCountdown(SESSION_WARN_SECONDS)
    }

    const markActive = () => {
      lastActivity = Date.now()
      if (expiring) {
        expiring = false
        stopCountdown()
      }
    }

    const startCountdown = () => {
      expiring = true
      setSessionExpiring(true)
      let remaining = SESSION_WARN_SECONDS
      setSessionCountdown(remaining)
      countdownTimer = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(countdownTimer)
          clearInterval(checkTimer)
          logout()
          return
        }
        setSessionCountdown(remaining)
      }, 1000)
    }

    const check = () => {
      if (LOCK_ENABLED && Date.now() - lastActivity >= LOCK_IDLE_MS) setLocked(true)
      if (expiring) return
      if (Date.now() - lastActivity >= IDLE_MS) startCountdown()
    }

    markActiveRef.current = markActive
    checkTimer = setInterval(check, 1000)
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    return () => {
      clearInterval(checkTimer)
      clearInterval(countdownTimer)
      markActiveRef.current = null
      events.forEach((e) => window.removeEventListener(e, markActive))
    }
  }, [user])

  const continueSession = () => markActiveRef.current?.()

  // Buka kunci layar: verifikasi PIN (= password admin) ke server.
  const unlock = async (pin) => {
    const res = await api.login(pin)
    localStorage.setItem('devnotes-token', res.token)
    setToken(res.token)
    setLocked(false)
    markActiveRef.current?.()
    return res
  }

  // ----- nextcloud / webdav -----
  const saveNextcloud = async (cfg) => {
    const saved = await api.saveNextcloudSettings(cfg)
    setNextcloud(saved)
    return saved
  }

  const testNextcloud = (cfg) => api.testNextcloud(cfg)

  const syncNextcloud = async () => {
    setProviderSyncing('webdav')
    setNextcloudSyncResult(null)
    try {
      const res = await api.syncNextcloud()
      setNextcloudSyncResult(res)
      return res
    } catch (e) {
      const res = { ok: false, error: e.message }
      setNextcloudSyncResult(res)
      return res
    } finally {
      setProviderSyncing(null)
    }
  }

  // ----- google drive -----
  const saveGdrive = async (cfg) => {
    const saved = await api.saveGdriveSettings(cfg)
    setGdrive(saved)
    return saved
  }

  const testGdrive = (cfg) => api.testGdrive(cfg)

  const startGdriveOAuth = async () => {
    const { url } = await api.startGdriveOAuth()
    window.location.href = url
  }

  const disconnectGdrive = async () => {
    const saved = await api.disconnectGdrive()
    setGdrive(saved)
    return saved
  }

  const syncGdrive = async () => {
    setProviderSyncing('gdrive')
    setGdriveSyncResult(null)
    try {
      const res = await api.syncGdrive()
      setGdriveSyncResult(res)
      return res
    } catch (e) {
      const res = { ok: false, error: e.message }
      setGdriveSyncResult(res)
      return res
    } finally {
      setProviderSyncing(null)
    }
  }

  // Sinkron semua provider yang aktif (tombol global).
  const syncAll = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.syncAll()
      setSyncResult(res)
      return res
    } catch (e) {
      const res = { ok: false, error: e.message }
      setSyncResult(res)
      return res
    } finally {
      setSyncing(false)
    }
  }

  const value = {
    user,
    authLoading,
    login,
    register,
    logout,
    notes,
    folders,
    tags,
    results,
    loading,
    searching,
    error,
    setError,
    activeId,
    setActiveId,
    activeNote,
    updateNote,
    createNote,
    createNoteFromTemplate,
    importMarkdown,
    deleteNote,
    createFolder,
    updateFolder,
    deleteFolder,
    createTag,
    addAttachment,
    removeAttachment,
    search,
    setSearch,
    activeFolder,
    setActiveFolder,
    activeTag,
    setActiveTag,
    sort,
    setSort,
    paletteOpen,
    setPaletteOpen,
    tplOpen,
    setTplOpen,
    folderModal,
    setFolderModal,
    folderModalTarget,
    setFolderModalTarget,
    folderToDelete,
    setFolderToDelete,
    tagModal,
    setTagModal,
    notesOpen,
    setNotesOpen,
    listWidth,
    setListWidth,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    settingsOpen,
    setSettingsOpen,
    nextcloud,
    gdrive,
    syncing,
    syncResult,
    providerSyncing,
    nextcloudSyncResult,
    gdriveSyncResult,
    notice,
    setNotice,
    saveNextcloud,
    testNextcloud,
    syncNextcloud,
    saveGdrive,
    testGdrive,
    startGdriveOAuth,
    disconnectGdrive,
    syncGdrive,
    syncAll,
    theme,
    toggleTheme,
    lang,
    setLang: changeLang,
    t,
    sessionExpiring,
    sessionCountdown,
    continueSession,
    locked,
    unlock,
    view,
    setView,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export { AppContext }