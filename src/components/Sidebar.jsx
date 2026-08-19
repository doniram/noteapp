import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Pin,
  Search,
  Command,
  LayoutTemplate,
  Server,
  Database,
  StickyNote,
  Terminal,
  Sun,
  Moon,
  X,
  LogOut,
} from 'lucide-react'
import { useApp } from '../context/useApp'

function FolderIcon({ name }) {
  const n = name.toLowerCase()
  const cls = 'h-4 w-4 shrink-0'
  if (n.includes('server') || n.includes('prod')) return <Server className={`${cls} text-sky-400`} />
  if (n.includes('db') || n.includes('database')) return <Database className={`${cls} text-cyan-400`} />
  if (n.includes('net')) return <Terminal className={`${cls} text-violet-400`} />
  if (n.includes('sop') || n.includes('prosed')) return <StickyNote className={`${cls} text-amber-400`} />
  if (n.includes('trouble') || n.includes('fix')) return <Terminal className={`${cls} text-rose-400`} />
  return <Folder className={`${cls} text-slate-400`} />
}

function Row({ active, onClick, children, indent = false }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
        indent ? 'ml-4' : ''
      } ${
        active
          ? 'bg-sky-500/15 text-sky-300'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

export default function Sidebar() {
  const {
    notes,
    folders,
    tags,
    activeFolder,
    setActiveFolder,
    activeTag,
    setActiveTag,
    setActiveId,
    setPaletteOpen,
    setTplOpen,
    setFolderModal,
    setTagModal,
    theme,
    toggleTheme,
    activeNote,
    user,
    logout,
    isMobile,
    setSidebarOpen,
  } = useApp()

  const closeMobile = () => {
    if (isMobile) setSidebarOpen(false)
  }

  const countInFolder = (id) => notes.filter((n) => n.folderId === id).length
  const countByTag = (id) => notes.filter((n) => n.tags.includes(id)).length
  const pinnedCount = notes.filter((n) => n.pinned).length

  const selectAll = () => {
    setActiveFolder(null)
    setActiveTag(null)
    setActiveId(null)
    closeMobile()
  }

  return (
    <aside
      className={
        isMobile
          ? 'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/70 bg-[#0d141d] shadow-2xl shadow-black/50'
          : 'flex h-full w-64 shrink-0 flex-col border-r border-slate-800/70 bg-[#0d141d]'
      }
    >
      <div className="flex items-center gap-2 border-b border-slate-800/70 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-950">
          <StickyNote className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold tracking-tight text-slate-100">DevNotes</div>
          <div className="text-[11px] text-slate-500">Dokumentasi teknis</div>
        </div>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            title="Tutup menu"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick search */}
      <div className="px-3 pt-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-[13px] text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Cari catatan...</span>
          <span className="flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] font-medium text-slate-400">
            <Command className="h-3 w-3" /> K
          </span>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <nav className="space-y-0.5">
          <Row active={!activeFolder && !activeTag} onClick={selectAll}>
            <FolderOpen className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="flex-1 font-medium">Semua Catatan</span>
            <span className="text-[11px] text-slate-600">{notes.length}</span>
          </Row>

          <Row
            active={activeTag === null && activeFolder === 'pinned'}
            onClick={() => {
              setActiveTag(null)
              setActiveFolder('pinned')
              setActiveId(null)
              closeMobile()
            }}
          >
            <Pin className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="flex-1 font-medium">Disematkan</span>
            <span className="text-[11px] text-slate-600">{pinnedCount}</span>
          </Row>
        </nav>

        {/* Folders */}
        <section>
          <div className="mb-1.5 flex items-center justify-between pr-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Folder
            </span>
            <button
              onClick={() => setFolderModal(true)}
              title="Buat folder baru"
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            <Row
              active={activeFolder === 'none'}
              onClick={() => {
                setActiveFolder('none')
                setActiveTag(null)
                setActiveId(null)
                closeMobile()
              }}
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="flex-1 italic">Tanpa folder</span>
              <span className="text-[11px] text-slate-600">
                {notes.filter((n) => !n.folderId).length}
              </span>
            </Row>
            {folders.map((folder) => (
              <Row
                key={folder.id}
                active={activeFolder === folder.id}
                onClick={() => {
                  setActiveFolder(folder.id)
                  setActiveTag(null)
                  setActiveId(null)
                  closeMobile()
                }}
              >
                <FolderIcon name={folder.name} />
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-[11px] text-slate-600">{countInFolder(folder.id)}</span>
              </Row>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section>
          <div className="mb-1.5 flex items-center justify-between pr-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Tag
            </span>
            <button
              onClick={() => setTagModal(true)}
              title="Buat tag baru"
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && (
              <span className="px-1 text-[12px] text-slate-600">Belum ada tag</span>
            )}
            {tags.map((tag) => {
              const active = activeTag === tag.id && activeFolder === null
              return (
                <button
                  key={tag.id}
                  onClick={() => {
                    setActiveTag(active ? null : tag.id)
                    setActiveFolder(null)
                    setActiveId(null)
                    closeMobile()
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-slate-600 bg-white/10 text-slate-100'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  #{tag.name}
                  <span className="text-slate-600">{countByTag(tag.id)}</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setTagModal(true)}
            className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-800 px-2.5 py-2 text-[12px] text-slate-500 transition-colors hover:border-sky-800 hover:bg-sky-500/10 hover:text-sky-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="font-medium">Tambah Tag</span>
          </button>
        </section>

        {/* Templates */}
        <section>
          <button
            onClick={() => {
              setTplOpen(true)
              closeMobile()
            }}
            className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-800 px-3 py-2.5 text-[13px] text-slate-500 transition-colors hover:border-sky-800 hover:bg-sky-500/10 hover:text-sky-300"
          >
            <LayoutTemplate className="h-4 w-4" />
            <span className="font-medium">Buat dari Template</span>
          </button>
        </section>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-800/70 px-3 py-3">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-amber-400"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1 text-[11px] leading-tight text-slate-500">
          <div className="flex items-center gap-1 truncate text-slate-400">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[9px] font-bold text-sky-400">
              {user?.username?.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{user?.username}</span>
          </div>
          <div className="text-slate-600">
            {notes.filter((n) => n.sensitive).length} terenkripsi ·{' '}
            {theme === 'dark' ? 'gelap' : 'terang'}
          </div>
        </div>
        <button
          onClick={logout}
          title="Keluar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
        {activeNote?.updatedAt && (
          <span className="ml-auto shrink-0 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-sky-400">
            autosave
          </span>
        )}
      </div>
    </aside>
  )
}