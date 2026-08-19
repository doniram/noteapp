import { useEffect, useRef, useState } from 'react'
import {
  Pin,
  Trash2,
  Eye,
  Pencil,
  Columns2,
  Download,
  FileText,
  Tag as TagIcon,
  Shield,
  Paperclip,
  Check,
  Clock,
  Lock,
  X,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Quote,
  Code2,
  Code,
  Link2,
  Image,
  List,
  ListOrdered,
  ListChecks,
  Table,
  Minus,
  Menu,
  ArrowLeft,
} from 'lucide-react'
import { useApp } from '../context/useApp'
import Markdown from './Markdown'
import { exportMarkdown, exportPdf, formatRange, formatBytes } from '../lib/utils.jsx'

const MODES = ['edit', 'split', 'preview']

const toolbar = [
  { icon: Bold, title: 'Tebal', kind: 'wrap', args: ['**', '**', 'teks tebal'] },
  { icon: Italic, title: 'Miring', kind: 'wrap', args: ['*', '*', 'teks miring'] },
  { icon: Strikethrough, title: 'Coret', kind: 'wrap', args: ['~~', '~~', 'teks'] },
  null,
  { icon: Heading2, title: 'Judul', kind: 'line', args: ['## '] },
  { icon: Quote, title: 'Kutipan', kind: 'line', args: ['> '] },
  null,
  { icon: Code2, title: 'Kode inline', kind: 'wrap', args: ['`', '`', 'kode'] },
  { icon: Code, title: 'Blok kode', kind: 'wrap', args: ['```bash\n', '\n```', 'perintah'] },
  null,
  { icon: Link2, title: 'Link', kind: 'wrap', args: ['[', '](https://)', 'teks link'] },
  { icon: Image, title: 'Gambar', kind: 'wrap', args: ['![', '](https://)', 'alt text'] },
  null,
  { icon: List, title: 'List', kind: 'line', args: ['- '] },
  { icon: ListOrdered, title: 'List nomor', kind: 'line', args: ['1. '] },
  { icon: ListChecks, title: 'Checklist', kind: 'line', args: ['- [ ] '] },
  null,
  { icon: Table, title: 'Tabel', kind: 'insert', args: ['| Kolom 1 | Kolom 2 |\n|---|---|\n|  |  |'] },
  { icon: Minus, title: 'Garis pemisah', kind: 'insert', args: ['\n---\n'] },
]

export default function Editor() {
  const {
    activeNote,
    updateNote,
    deleteNote,
    createNote,
    folders,
    tags,
    addAttachment,
    removeAttachment,
    setActiveTag,
    setTplOpen,
    setActiveId,
    isMobile,
    setSidebarOpen,
  } = useApp()

  const createNew = () => {
    const note = createNote()
    setActiveTag(null)
    return note
  }

  const [mode, setMode] = useState('split') // always starts split
  const [savedAt, setSavedAt] = useState(null)
  const [showAllTags, setShowAllTags] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // mobile can't show split view
  const modes = isMobile ? MODES.filter((m) => m !== 'split') : MODES
  const effectiveMode = isMobile && mode === 'split' ? 'edit' : mode

  // periodic "saved" pulse
  useEffect(() => {
    if (!activeNote) return
    const t = setTimeout(() => setSavedAt(new Date().toISOString()), 600)
    return () => clearTimeout(t)
  }, [activeNote])

  const applyFormat = (kind, args) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart, selectionEnd, value } = ta
    if (kind === 'wrap') {
      const [before, after, ph = ''] = args
      const selected = value.slice(selectionStart, selectionEnd)
      const middle = selected || ph
      const next =
        value.slice(0, selectionStart) + before + middle + after + value.slice(selectionEnd)
      updateNote(activeNote.id, { content: next })
      requestAnimationFrame(() => {
        ta.focus()
        const start = selectionStart + before.length
        if (selected) ta.setSelectionRange(start, start + middle.length)
        else if (ph) ta.setSelectionRange(start, start + ph.length)
        else ta.setSelectionRange(start + middle.length, start + middle.length)
      })
    } else if (kind === 'line') {
      const [before] = args
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const next = value.slice(0, lineStart) + before + value.slice(lineStart)
      updateNote(activeNote.id, { content: next })
      requestAnimationFrame(() => {
        ta.focus()
        const end = selectionEnd + before.length
        ta.setSelectionRange(lineStart + before.length, end)
      })
    } else {
      const [text] = args
      const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd)
      updateNote(activeNote.id, { content: next })
      requestAnimationFrame(() => {
        ta.focus()
        const pos = selectionStart + text.length
        ta.setSelectionRange(pos, pos)
      })
    }
  }

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      applyFormat('wrap', ['**', '**', 'teks tebal'])
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      applyFormat('wrap', ['*', '*', 'teks miring'])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const { selectionStart, selectionEnd, value } = ta
      const next = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
      updateNote(activeNote.id, { content: next })
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(selectionStart + 2, selectionStart + 2)
      })
    }
  }

  if (!activeNote) {
    return <EmptyEditor onCreate={createNew} setTplOpen={setTplOpen} />
  }

  const note = activeNote
  const noteTags = note.tags.map((id) => tags.find((t) => t.id === id)).filter(Boolean)
  const unusedTags = tags.filter((t) => !note.tags.includes(t.id))

  const addTag = (tid) => {
    note.tags.push(tid)
    updateNote(note.id, { tags: [...note.tags] })
  }
  const removeTag = (tid) => updateNote(note.id, { tags: note.tags.filter((t) => t !== tid) })

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[#0b0f14]">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-800/70 px-3 py-2.5 md:px-5">
        {isMobile && (
          <>
            <button
              onClick={() => setSidebarOpen(true)}
              title="Buka menu"
              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveId(null)}
              title="Kembali ke daftar"
              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-sky-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-800" />
          </>
        )}
        <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
          {modes.map((m) => {
            const Icon = m === 'edit' ? Pencil : m === 'split' ? Columns2 : Eye
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={m}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  effectiveMode === m
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {m === 'split' ? 'Split' : m === 'edit' ? 'Edit' : 'Preview'}
              </button>
            )
          })}
        </div>

        <div className="h-5 w-px bg-slate-800" />

        <button
          onClick={() => updateNote(note.id, { pinned: !note.pinned })}
          title="Sematan ke daftar teratas"
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
            note.pinned
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
          }`}
        >
          <Pin className={`h-3.5 w-3.5 ${note.pinned ? 'fill-amber-400' : ''}`} />
          {note.pinned ? 'Disematkan' : 'Pin'}
        </button>

        <button
          onClick={() => updateNote(note.id, { sensitive: !note.sensitive })}
          title="Tandai sensitif (terenkripsi)"
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
            note.sensitive
              ? 'bg-rose-500/15 text-rose-400'
              : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
          }`}
        >
          {note.sensitive ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          {note.sensitive ? 'Terenkripsi' : 'Sensitive'}
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-emerald-500">
            {savedAt ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3 animate-pulse" />}
            Tersimpan {savedAt ? formatRange(savedAt) : '...'}
          </span>

          <button
            onClick={() => exportMarkdown({ ...note, folderName: folders.find((f) => f.id === note.folderId)?.name })}
            title="Export Markdown"
            className="flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-[12px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" /> .md
          </button>
          <button
            onClick={() => exportPdf(note)}
            title="Export PDF"
            className="flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-[12px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>

          <button
            onClick={() => deleteNote(note.id)}
            title="Hapus catatan"
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-slate-800/70 px-5 pb-3 pt-4">
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          placeholder="Judul catatan..."
          className="w-full bg-transparent text-xl font-bold tracking-tight text-slate-100 placeholder:text-slate-700 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Folder select */}
          <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
            <FileText className="h-3 w-3 text-slate-500" />
            <select
              value={note.folderId || ''}
              onChange={(e) => updateNote(note.id, { folderId: e.target.value || null })}
              className="bg-transparent text-[12px] text-slate-300 focus:outline-none"
            >
              <option value="">Tanpa folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          {noteTags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color: tag.color, backgroundColor: tag.color + '1a' }}
            >
              #{tag.name}
              <button onClick={() => removeTag(tag.id)} className="opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {unusedTags.length > 0 && (
            <>
              <button
                onClick={() => setShowAllTags((v) => !v)}
                className="flex items-center gap-0.5 rounded-full border border-dashed border-slate-700 px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-300"
              >
                <TagIcon className="h-3 w-3" /> + Tag
              </button>
              {showAllTags && (
                <div className="flex flex-wrap gap-1">
                  {unusedTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        addTag(t.id)
                        setShowAllTags(false)
                      }}
                      className="rounded-full border border-slate-800 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-600 hover:text-slate-200"
                    >
                      #{t.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <span className="ml-auto text-[11px] text-slate-600">
            Diubah {formatRange(note.updatedAt)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {(effectiveMode === 'edit' || effectiveMode === 'split') && (
          <div
            className={`flex min-w-0 flex-col border-r border-slate-800/40 ${
              effectiveMode === 'split' ? 'flex-1' : 'w-full'
            }`}
          >
            {/* toolstrip */}
            <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-800/60 bg-[#0d141d] px-2 py-1.5">
              {toolbar.map((t, i) =>
                t === null ? (
                  <div key={`sep-${i}`} className="mx-1 h-4 w-px shrink-0 bg-slate-800" />
                ) : (
                  <button
                    key={i}
                    onClick={() => applyFormat(t.kind, t.args)}
                    title={t.title}
                    className="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
                  >
                    <t.icon className="h-4 w-4" />
                  </button>
                )
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={note.content}
              onChange={(e) => updateNote(note.id, { content: e.target.value })}
              onKeyDown={onKeyDown}
              spellCheck={false}
              placeholder="Tulis markdown di sini... (ex: ```bash, # judul, - list)"
              className="min-h-0 flex-1 w-full resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed text-slate-300 placeholder:text-slate-700 focus:outline-none"
            />
          </div>
        )}
        {(effectiveMode === 'preview' || effectiveMode === 'split') && (
          <div
            onClick={(e) => {
              const a = e.target.closest('a')
              if (a?.href?.startsWith('http')) {
                e.preventDefault()
                window.open(a.href, '_blank')
              }
            }}
            className={`min-w-0 overflow-y-auto bg-[#0b0f14] p-6 ${
              effectiveMode === 'split' ? 'flex-1' : 'w-full'
            }`}
          >
            <Markdown content={note.content} />
          </div>
        )}
      </div>

      {/* Attachments footer */}
      <div className="flex items-center gap-2 border-t border-slate-800/70 px-5 py-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            for (const file of e.target.files) addAttachment(note.id, file)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-200"
        >
          <Paperclip className="h-3 w-3" /> Lampirkan file
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {note.attachments.map((a) => (
            <span
              key={a.id}
              className="group flex cursor-pointer items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
              title="Unduh lampiran"
              onClick={() => window.open(`/api/attachments/${a.id}/download`, '_blank')}
            >
              <FileText className="h-3 w-3 text-sky-500" />
              {a.name}
              <span className="text-[10px] text-slate-600">{formatBytes(a.size)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeAttachment(note.id, a.id)
                }}
                title="Hapus lampiran"
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {note.attachments.length === 0 && (
            <span className="text-[11px] text-slate-700">Belum ada lampiran</span>
          )}
        </div>
      </div>
    </main>
  )
}

function EmptyEditor({ setTplOpen, onCreate }) {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50">
        <FileText className="h-7 w-7 text-slate-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-200">Pilih atau buat catatan</h2>
        <p className="mt-1 max-w-sm text-[13px] text-slate-500">
          Dokumentasikan konfigurasi server, SOP, dan troubleshooting. Cari cepat dengan{' '}
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[11px]">Ctrl</kbd>{' '}
          +{' '}
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[11px]">K</kbd>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setTplOpen(true)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        >
          Pakai Template
        </button>
        <button
          onClick={() => onCreate()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-sky-500"
        >
          + Catatan Baru
        </button>
      </div>
    </main>
  )
}