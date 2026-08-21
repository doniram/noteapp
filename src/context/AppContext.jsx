import { createContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, setToken, setUnauthorizedHandler } from '../api'
import { uid } from '../lib/utils.jsx'

const AppContext = createContext(null)

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
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
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

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

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
  const pendingSave = useRef({})

  // ----- base data -----
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [f, t, cfg] = await Promise.all([
          api.getFolders(),
          api.getTags(),
          api.getNextcloudSettings(),
        ])
        setFolders(f)
        setTags(t)
        setNextcloud(cfg)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
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
            for (const n of list) map.set(n.id, n)
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
  const updateNote = (id, patch) => {
    const now = new Date().toISOString()
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)))
    setResults((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)))

    clearTimeout(pendingSave.current[id])
    pendingSave.current[id] = setTimeout(async () => {
      const full = notesRef.current.find((n) => n.id === id)
      if (!full) return
      try {
        const saved = await api.updateNote(id, full)
        setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)))
        setResults((prev) => prev.map((n) => (n.id === id ? saved : n)))
      } catch (e) {
        setError(e.message)
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
    try {
      const saved = await api.createNote(temp)
      setNotes((prev) => prev.map((n) => (n.id === temp.id ? saved : n)))
      setResults((prev) => prev.map((n) => (n.id === temp.id ? saved : n)))
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

  const deleteNote = async (id) => {
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
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setResults((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      return att
    } catch (e) {
      setError(e.message)
    }
  }

  const removeAttachment = async (noteId, attId) => {
    try {
      await api.deleteAttachment(attId)
      const updated = await api.getNote(noteId)
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setResults((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
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
  }

  const register = async (username, password) => {
    const res = await api.register(username, password)
    localStorage.setItem('devnotes-token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
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
  }

  // ----- nextcloud / webdav -----
  const saveNextcloud = async (cfg) => {
    const saved = await api.saveNextcloudSettings(cfg)
    setNextcloud(saved)
    return saved
  }

  const testNextcloud = (cfg) => api.testNextcloud(cfg)

  const syncNextcloud = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.syncNextcloud()
      setSyncResult(res)
      return res
    } catch (e) {
      setSyncResult({ ok: false, error: e.message })
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
    syncing,
    syncResult,
    saveNextcloud,
    testNextcloud,
    syncNextcloud,
    theme,
    toggleTheme,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export { AppContext }