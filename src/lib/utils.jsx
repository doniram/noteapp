export function timeAgo(iso) {
  const then = new Date(iso)
  const diff = Date.now() - then.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min}m lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}j lalu`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}h lalu`
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatRange(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~|[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function highlightText(text, query) {
  if (!query) return text
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return text
  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    part.match(re) ? (
      <mark key={i} className="rounded-sm bg-sky-400/30 px-0.5 text-sky-200">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function uid() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return bytes ? `${bytes} B` : '0 B'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

export const exportMarkdown = (note) => {
  const header = `# ${note.title}\n\n---\n_Parent / Folder:_ **${note.folderName || 'Tanpa Folder'}**  \n_Tags:_ ${note.tags.map((t) => `#${t}`).join(', ') || '-'}  \n_Dibuat:_ ${formatRange(note.createdAt)}  \n_Diubah:_ ${formatRange(note.updatedAt)}  \n\n---\n\n`
  const blob = new Blob([header + note.content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${note.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'note'}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export const exportPdf = (note) => {
  const win = window.open('', '_blank')
  if (!win) return
  const body = note.content
    .replace(/```(\w+)?/g, (m, lang) => (lang ? `<pre><code class="language-${lang}">` : '<pre><code>'))
  win.document.write(`<!doctype html><html><head><title>${note.title}</title>
<style>
body{font-family:Georgia,serif;line-height:1.7;max-width:720px;margin:40px auto;color:#111;padding:0 24px}
h1,h2{font-family:sans-serif}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap}
code{background:#f4f4f5;padding:2px 4px;border-radius:4px;font-size:.9em}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d4d4d8;padding:6px 10px;text-align:left}
th{background:#f4f4f5}
</style></head><body><h1>${note.title}</h1><hr>${body}</body></html>`)
  win.document.close()
  win.focus()
  win.print()
}