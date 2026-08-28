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
  Settings as SettingsIcon,
  Network,
  Cloud,
  Shield,
  Globe,
  HardDrive,
  Layers,
  Trash2,
  Pencil,
  ListTodo,
} from 'lucide-react'
import { useApp } from '../context/useApp'

const FOLDER_ICON_MAP = {
  folder: [Folder, 'text-slate-400'],
  server: [Server, 'text-sky-400'],
  database: [Database, 'text-cyan-400'],
  network: [Network, 'text-violet-400'],
  terminal: [Terminal, 'text-rose-400'],
  file: [FileText, 'text-amber-400'],
  cloud: [Cloud, 'text-sky-300'],
  shield: [Shield, 'text-emerald-400'],
  gear: [SettingsIcon, 'text-slate-300'],
  globe: [Globe, 'text-blue-400'],
  drive: [HardDrive, 'text-amber-300'],
  layers: [Layers, 'text-purple-300'],
}

function FolderIcon({ name, icon }) {
  const cls = 'h-4 w-4 shrink-0'
  if (icon && FOLDER_ICON_MAP[icon]) {
    const [Ic, color] = FOLDER_ICON_MAP[icon]
    return <Ic className={`${cls} ${color}`} />
  }
  const n = (name || '').toLowerCase()
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
    setFolderModalTarget,
    setFolderToDelete,
    setTagModal,
    theme,
    toggleTheme,
    activeNote,
    logout,
    isMobile,
    setSidebarOpen,
    setSettingsOpen,
    view,
    setView,
    t,
    lang,
    setLang,
  } = useApp()

  const closeMobile = () => {
    if (isMobile) setSidebarOpen(false)
  }

  const goNotes = () => {
    setView('notes')
    closeMobile()
  }

  const countInFolder = (id) => notes.filter((n) => n.folderId === id).length
  const countByTag = (id) => notes.filter((n) => n.tags.includes(id)).length
  const pinnedCount = notes.filter((n) => n.pinned).length

  const selectAll = () => {
    setActiveFolder(null)
    setActiveTag(null)
    setActiveId(null)
    setView('notes')
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
          <div className="text-[11px] text-slate-500">{t('side.subtitle')}</div>
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
          <span className="flex-1 text-left">{t('side.search')}</span>
          <span className="flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] font-medium text-slate-400">
            <Command className="h-3 w-3" /> K
          </span>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
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
            <span className="font-medium">{t('side.fromTemplate')}</span>
          </button>
        </section>

        <section>
          <Row active={view === 'tasks'} onClick={() => { setView('tasks'); closeMobile() }}>
            <ListTodo className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="flex-1 font-medium">{t('side.tasks')}</span>
          </Row>
        </section>

        <nav className="space-y-0.5">
          <Row active={view === 'notes' && !activeFolder && !activeTag} onClick={selectAll}>
            <FolderOpen className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="flex-1 font-medium">{t('side.allNotes')}</span>
            <span className="text-[11px] text-slate-600">{notes.length}</span>
          </Row>

          <Row
            active={view === 'notes' && activeTag === null && activeFolder === 'pinned'}
            onClick={() => {
              setActiveTag(null)
              setActiveFolder('pinned')
              setActiveId(null)
              goNotes()
            }}
          >
            <Pin className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="flex-1 font-medium">{t('side.pinned')}</span>
            <span className="text-[11px] text-slate-600">{pinnedCount}</span>
          </Row>
        </nav>

        {/* Folders */}
        <section>
          <div className="mb-1.5 flex items-center justify-between pr-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              {t('side.folders')}
            </span>
            <button
              onClick={() => setFolderModal(true)}
              title={t('side.newFolder')}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            <Row
              active={view === 'notes' && activeFolder === 'none'}
              onClick={() => {
                setActiveFolder('none')
                setActiveTag(null)
                setActiveId(null)
                goNotes()
              }}
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="flex-1 italic">{t('common.noFolder')}</span>
              <span className="text-[11px] text-slate-600">
                {notes.filter((n) => !n.folderId).length}
              </span>
            </Row>
            {folders.map((folder) => {
              const active = activeFolder === folder.id
              return (
                <div key={folder.id} className="group relative flex items-center">
                  <button
                    onClick={() => {
                      setActiveFolder(folder.id)
                      setActiveTag(null)
                      setActiveId(null)
                      goNotes()
                    }}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                      active
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <FolderIcon name={folder.name} icon={folder.icon} />
                    <span className="flex-1 truncate">{folder.name}</span>
                    <span className="text-[11px] text-slate-600 transition-opacity group-hover:opacity-0">
                      {countInFolder(folder.id)}
                    </span>
                  </button>
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setFolderModalTarget(folder)
                        setFolderModal(true)
                      }}
                      title={t('side.editFolder')}
                      className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-sky-300"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setFolderToDelete(folder)}
                      title={t('side.deleteFolder')}
                      className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Tags */}
        <section>
          <div className="mb-1.5 flex items-center justify-between pr-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              {t('side.tags')}
            </span>
            <button
              onClick={() => setTagModal(true)}
              title={t('side.addTag')}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && (
              <span className="px-1 text-[12px] text-slate-600">{t('side.noTags')}</span>
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
                      goNotes()
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
            <span className="font-medium">{t('side.addTag')}</span>
          </button>
        </section>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-800/70 px-3 py-3">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t('side.lightMode') : t('side.darkMode')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-amber-400"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title={t('side.settings')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          title={lang === 'id' ? 'Switch to English' : 'Beralih ke Indonesia'}
          className="flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-800 px-1.5 text-[11px] font-semibold uppercase text-slate-400 transition-colors hover:bg-white/10 hover:text-sky-300"
        >
          {lang === 'id' ? 'EN' : 'ID'}
        </button>
        <div className="flex-1" />
        <button
          onClick={logout}
          title={t('side.logout')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
        {activeNote?.updatedAt && (
          <span className="ml-auto shrink-0 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-sky-400">
            {t('side.autosave')}
          </span>
        )}
      </div>
    </aside>
  )
}