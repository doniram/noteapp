import { useEffect, useRef, useState } from 'react'
import { Search, CornerDownLeft, Plus, Hash, Pin, Loader2 } from 'lucide-react'
import { useApp } from '../context/useApp'
import { api } from '../api'
import { highlightText, stripMarkdown } from '../lib/utils.jsx'

export default function CommandPalette() {
  const {
    folders,
    tags,
    setPaletteOpen,
    setActiveId,
    createNote,
    t,
  } = useApp()

  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      const q = query.trim()
      if (!q) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const list = await api.getNotes({ search: q, sort: 'updated' })
        if (!cancelled) setResults(list.slice(0, 30))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const open = (id) => {
    setActiveId(id)
    setPaletteOpen(false)
  }

  const newNote = () => {
    createNote()
    setPaletteOpen(false)
  }

  const activeCount = results.length

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setPaletteOpen(false)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(i + 1, activeCount))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === 0) return newNote()
      const item = results[idx - 1]
      if (item) open(item.id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => setPaletteOpen(false)}
    >
      <div
        className="w-[600px] max-w-[90vw] overflow-hidden rounded-xl border border-slate-700 bg-[#0d141d] shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIdx(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            className="flex-1 bg-transparent text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            ESC
          </span>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          <button
            onMouseDown={newNote}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] ${
              idx === 0
                ? 'bg-sky-500/15 text-sky-300'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">{t('palette.newNote')}</span>
            <CornerDownLeft className="ml-auto h-3.5 w-3.5 opacity-50" />
          </button>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('palette.searching')}
            </div>
          ) : results.length === 0 && query ? (
            <div className="px-3 py-8 text-center text-[13px] text-slate-500">
              {t('palette.noResults', { q: query })}
            </div>
          ) : (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {query ? t('palette.results', { n: results.length }) : t('palette.type')}
              </div>
              {results.map((n, i) => {
                const snippet = n.snippet ?? stripMarkdown(n.content)
                const firstLine = snippet.slice(0, 80)
                const folder = folders.find((f) => f.id === n.folderId)
                return (
                  <button
                    key={n.id}
                    onMouseDown={() => open(n.id)}
                    onMouseEnter={() => setIdx(i + 1)}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                      idx === i + 1 ? 'bg-sky-500/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                        idx === i + 1 ? 'border-sky-500' : 'border-slate-700'
                      }`}
                    >
                      {n.pinned && <Pin className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-slate-200">
                          {highlightText(n.title, query)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                        {highlightText(firstLine, query)}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                        {folder?.name && (
                          <span className="flex items-center gap-0.5">
                            <Hash className="h-2.5 w-2.5" />
                            {folder.name}
                          </span>
                        )}
                        {n.tags.slice(0, 3).map((tid) => {
                          const t = tags.find((x) => x.id === tid)
                          return t ? (
                            <span key={tid} style={{ color: t.color }}>
                              #{t.name}
                            </span>
                          ) : null
                        })}
                      </span>
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-2 text-[11px] text-slate-600">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> {t('palette.open')}
          </span>
          <span className="flex items-center gap-1">{t('palette.nav')}</span>
          <span className="ml-auto text-slate-700">DevNotes</span>
        </div>
      </div>
    </div>
  )
}