import { useEffect, useRef } from 'react'
import { ChevronRight, StickyNote, CloudUpload, Loader2 } from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import Sidebar from './components/Sidebar'
import NoteList from './components/NoteList'
import Editor from './components/Editor'
import CommandPalette from './components/CommandPalette'
import TemplateModal from './components/TemplateModal'
import FolderModal from './components/FolderModal'
import TagModal from './components/TagModal'
import Login from './components/Login'
import Settings from './components/Settings'

function KeyboardShortcuts() {
  const { setPaletteOpen } = useApp()
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen])
  return null
}

function SplashScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0b0f14]">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600">
          <StickyNote className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-medium">Memuat...</span>
      </div>
    </div>
  )
}

function ResizeHandle() {
  const { listWidth, setListWidth } = useApp()
  const dragging = useRef(false)

  const onMouseDown = (e) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startWidth = listWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      if (!dragging.current) return
      setListWidth(Math.min(720, Math.max(240, startWidth + (ev.clientX - startX))))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={() => setListWidth(384)}
      title="Geser untuk ubah ukuran"
      className="group relative w-1.5 shrink-0 cursor-col-resize bg-slate-800/40 transition-colors hover:bg-sky-500/40 active:bg-sky-500/60"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-700/50" />
    </div>
  )
}

function Workspace() {
  const {
    paletteOpen,
    notesOpen,
    setNotesOpen,
    error,
    setError,
    loading,
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    activeId,
  } = useApp()
  return (
    <div className="flex h-full">
      {isMobile ? (
        sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <Sidebar />
          </>
        )
      ) : (
        <Sidebar />
      )}

      {isMobile ? (
        activeId ? (
          <Editor />
        ) : (
          <NoteList />
        )
      ) : (
        <>
          {notesOpen ? (
            <>
              <NoteList />
              <ResizeHandle />
            </>
          ) : (
            <div className="flex w-9 shrink-0 flex-col items-center border-r border-slate-800/70 bg-[#0b111a] pt-3">
              <button
                onClick={() => setNotesOpen(true)}
                title="Tampilkan daftar catatan"
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <Editor />
        </>
      )}

      {paletteOpen && <CommandPalette />}
      {loading && !error && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0d141d] px-3 py-2 text-[12px] text-slate-400 shadow-xl shadow-black/30">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Menghubungkan ke server…
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-rose-800/70 bg-rose-950/90 px-3 py-2 text-[12px] text-rose-300 shadow-xl shadow-black/30">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="rounded p-0.5 text-rose-400 hover:text-rose-200"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function SyncButton() {
  const { syncing, syncResult, syncNextcloud } = useApp()
  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-1.5">
      <button
        onClick={() => syncNextcloud()}
        disabled={syncing}
        title="Sinkronkan semua catatan (.md) ke Nextcloud"
        className="flex items-center gap-2 rounded-full border border-slate-800 bg-[#0d141d] px-4 py-2 text-[13px] font-medium text-slate-300 shadow-xl shadow-black/40 transition-colors hover:border-sky-700 hover:text-sky-300 disabled:opacity-60"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CloudUpload className="h-4 w-4" />
        )}
        {syncing ? 'Menyinkronkan...' : 'Sinkron'}
      </button>
      {syncResult && !syncing && (
        <span
          className={`max-w-[260px] rounded-md border px-2 py-1 text-[11px] leading-snug ${
            syncResult.ok
              ? 'border-emerald-800/60 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-800/60 bg-rose-950/90 text-rose-300'
          }`}
        >
          {syncResult.ok ? syncResult.message : syncResult.error || syncResult.message}
        </span>
      )}
    </div>
  )
}

function AppShell() {
  const { user, authLoading, settingsOpen } = useApp()
  if (authLoading) return <SplashScreen />
  if (!user) return <Login />
  return (
    <>
      <KeyboardShortcuts />
      <Workspace />
      <SyncButton />
      <TemplateModal />
      <FolderModal />
      <TagModal />
      {settingsOpen && <Settings />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <div className="h-full overflow-hidden">
        <AppShell />
      </div>
    </AppProvider>
  )
}