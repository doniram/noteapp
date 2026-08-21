import { Search, X, Pin, FileText, ArrowUpDown, Plus, Paperclip, ChevronLeft, Menu } from 'lucide-react'
import { useApp } from '../context/useApp'
import { timeAgo, highlightText, stripMarkdown } from '../lib/utils.jsx'

function getSearchSnippet(note, query, maxLen = 130) {
  const text = stripMarkdown(note.content)
  if (!query) return text.slice(0, maxLen)
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const slice = text.slice(start, start + maxLen)
  return (start > 0 ? '…' : '') + slice + (start + maxLen < text.length ? '…' : '')
}

function AttachmentBadge() {
  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-600">
      <Paperclip className="h-3 w-3" />
      file
    </span>
  )
}

export default function NoteList() {
  const {
    folders,
    tags,
    results,
    searching,
    search,
    setSearch,
    activeFolder,
    activeTag,
    activeId,
    setActiveId,
    setTplOpen,
    createNote,
    setActiveFolder,
    setActiveTag,
    setNotesOpen,
    sort,
    setSort,
    listWidth,
    isMobile,
    setSidebarOpen,
  } = useApp()

  const folderName =
    activeFolder === 'pinned'
      ? 'Disematkan'
      : activeFolder === 'none'
        ? 'Tanpa folder'
        : folders.find((f) => f.id === activeFolder)?.name
  const tagName = tags.find((t) => t.id === activeTag)?.name

  const filtered = results

  const heading = search
    ? `Hasil pencarian: "${search}"`
    : activeTag
      ? `Tag #${tagName}`
      : folderName || 'Semua Catatan'

  const clearFilter = () => {
    setSearch('')
    setActiveFolder(null)
    setActiveTag(null)
  }

  return (
    <section
      style={{ width: listWidth }}
      className="relative flex h-full shrink-0 flex-col border-r border-slate-800/70 bg-[#0b111a]"
    >
      {!isMobile && (
        <button
          onClick={() => setNotesOpen(false)}
          title="Sembunyikan daftar catatan"
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-600 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="border-b border-slate-800/70 px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-1">
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              title="Buka menu"
              className="rounded p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-slate-100">
            <span className="truncate">{heading}</span>
            {(activeFolder || activeTag || search) && (
              <button
                onClick={clearFilter}
                title="Reset filter"
                className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </h2>
          <span className="ml-auto text-[11px] text-slate-600">
            {searching ? 'mencari…' : `${filtered.length} catatan`}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari di semua catatan..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-1.5 pl-8 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none"
          />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
          <button
            onClick={() =>
              setSort(sort === 'updated' ? 'created' : sort === 'created' ? 'title' : 'updated')
            }
            className="flex items-center gap-1 rounded border border-slate-800 px-1.5 py-0.5 hover:border-slate-600 hover:text-slate-300"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sort === 'updated' ? 'Diubah' : sort === 'created' ? 'Dibuat' : 'Judul'}
          </button>
          <button
            onClick={() => setTplOpen(true)}
            className="flex items-center gap-1 rounded border border-slate-800 px-1.5 py-0.5 hover:border-sky-700 hover:text-sky-300"
          >
            <Plus className="h-3 w-3" /> Template
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2 pl-9">
        {filtered.length === 0 && (
          <EmptyState onCreate={() => createNote()} />
        )}

        {filtered.map((note) => {
          const active = note.id === activeId
          const snippet = note.snippet ?? getSearchSnippet(note, search.trim())
          return (
            <button
              key={note.id}
              onClick={() => setActiveId(note.id)}
              className={`block w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-sky-700/60 bg-sky-500/10'
                  : 'border-transparent hover:border-slate-800 hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {note.pinned && <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                <span
                  className={`flex-1 truncate text-[13px] font-medium ${
                    active ? 'text-sky-200' : 'text-slate-200'
                  }`}
                >
                  {highlightText(note.title, search.trim())}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                {highlightText(snippet, search.trim())}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5">
                {note.attachments.length > 0 && <AttachmentBadge />}
                {note.folderId && (
                  <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                    <FileText className="h-2.5 w-2.5" />
                    {folders.find((f) => f.id === note.folderId)?.name}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-slate-600">
                  {timeAgo(note.updatedAt)}
                </span>
              </div>

              {note.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {note.tags.slice(0, 3).map((tid) => {
                    const t = tags.find((x) => x.id === tid)
                    if (!t) return null
                    return (
                      <span
                        key={tid}
                        className="rounded px-1 py-px text-[9px] font-medium"
                        style={{
                          color: t.color,
                          backgroundColor: t.color + '1a',
                        }}
                      >
                        #{t.name}
                      </span>
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60">
        <Search className="h-5 w-5 text-slate-600" />
      </div>
      <div>
        <div className="text-[13px] font-medium text-slate-300">Tidak ada hasil</div>
        <div className="mt-0.5 text-[12px] text-slate-600">
          Coba kata kunci lain, atau buat catatan baru.
        </div>
      </div>
      <button
        onClick={onCreate}
        className="rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-sky-500"
      >
        + Catatan Baru
      </button>
    </div>
  )
}