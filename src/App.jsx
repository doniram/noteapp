import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  StickyNote,
  CloudUpload,
  X,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import Sidebar from './components/Sidebar'
import NoteList from './components/NoteList'
import Editor from './components/Editor'
import CommandPalette from './components/CommandPalette'
import TemplateModal from './components/TemplateModal'
import FolderModal from './components/FolderModal'
import DeleteFolderModal from './components/DeleteFolderModal'
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
            <div className="flex w-9 shrink-0 flex-col items-center justify-center border-r border-slate-800/70 bg-[#0b111a]">
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
  const { syncing, syncResult, syncNextcloud, isMobile } = useApp()
  const expanded = isMobile || syncing
  const [autoHide, setAutoHide] = useState(false)

  useEffect(() => {
    if (syncing || !syncResult) return
    const t = setTimeout(() => setAutoHide(true), 7000)
    return () => clearTimeout(t)
  }, [syncResult, syncing])

  const showResult = !syncing && !!syncResult && !autoHide
  const resultOk = syncResult?.ok
  const resultMessage = syncResult
    ? syncResult.ok
      ? syncResult.message
      : syncResult.error || syncResult.message
    : ''

  const handleSync = () => {
    setAutoHide(false)
    syncNextcloud()
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-center justify-end">
      <button
        onClick={showResult ? () => setAutoHide(true) : handleSync}
        disabled={syncing}
        title="Sinkronkan semua catatan (.md) ke Nextcloud"
        className={`flex h-11 items-center overflow-hidden rounded-full border bg-[#0d141d] shadow-lg shadow-black/40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showResult
            ? `min-w-11 max-w-[340px] gap-2 px-4 text-[12px] font-medium leading-snug ${
                resultOk
                  ? 'border-emerald-600 text-emerald-100'
                  : 'border-rose-600 text-rose-100'
              }`
            : `min-w-11 text-[13px] ${syncing ? 'border-sky-700' : 'border-slate-800'} ${
                expanded && !syncing
                  ? 'max-w-[340px] justify-center gap-2 px-4'
                  : 'max-w-11 justify-center'
              }`
        }`}
      >
        {showResult ? (
          <>
            <span className="shrink-0">
              {resultOk ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{resultMessage}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setAutoHide(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setAutoHide(true)
              }}
              title="Tutup"
              className="-mr-1 shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </>
        ) : (
          <>
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <span
                className={`pointer-events-none absolute -inset-2 rounded-full border-2 border-dashed ${
                  syncing ? 'animate-spin border-sky-500/70' : 'border-sky-500/40'
                }`}
                style={!syncing ? { animation: 'spin-slow 8s linear infinite' } : undefined}
              />
              <CloudUpload className={`h-4 w-4 ${syncing ? 'animate-pulse text-sky-400' : ''}`} />
            </span>
            {expanded && !syncing && <span className="whitespace-nowrap">Sinkron Now</span>}
          </>
        )}
      </button>
    </div>
  )
}

function SessionTimeoutModal() {
  const { sessionExpiring, sessionCountdown, continueSession } = useApp()
  if (!sessionExpiring) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-xl border border-amber-700/60 bg-[#0d141d] px-6 py-6 text-center shadow-2xl shadow-black/60">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <LogOut className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Sesi akan berakhir</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
            Tidak ada aktivitas deteksi. Logout otomatis dalam{' '}
            <span className="font-semibold text-amber-400">{sessionCountdown}</span> detik.
          </p>
        </div>
        <button
          onClick={continueSession}
          className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
        >
          Lanjutkan Sesi
        </button>
      </div>
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
      <DeleteFolderModal />
      <TagModal />
      {settingsOpen && <Settings />}
      <SessionTimeoutModal />
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