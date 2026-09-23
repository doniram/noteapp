import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { common } from 'lowlight'
import nginx from 'highlight.js/lib/languages/nginx'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import apache from 'highlight.js/lib/languages/apache'
import powershell from 'highlight.js/lib/languages/powershell'
import dos from 'highlight.js/lib/languages/dos'
import properties from 'highlight.js/lib/languages/properties'
import { visit } from 'unist-util-visit'
import { authedImageUrl } from '../api'

// Daftar `common` bawaan lowlight tidak memuat bahasa ops berikut, sehingga blok
// seperti ```nginx / ```dockerfile jatuh ke teks biasa. Tambahkan di sini.
const highlightLanguages = {
  ...common,
  nginx,
  dockerfile,
  apache,
  powershell,
  dos,
  properties,
}

// nama bahasa terdaftar -> variasi penulisan tag (key lowlight, value alias).
const highlightAliases = {
  nginx: ['conf', 'nginxconf'],
  dockerfile: ['docker', 'containerfile'],
  apache: ['apacheconf'],
  powershell: ['ps', 'ps1'],
  dos: ['bat', 'batch', 'cmd'],
  yaml: ['yml'],
  bash: ['sh', 'zsh', 'ksh', 'console'],
  properties: ['env', 'dotenv'],
}

// Remark plugin: render ==text== as <mark>
function remarkMark() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      const parts = node.value.split(/(==[^=\n]+==)/)
      if (parts.length === 1) return
      const children = []
      for (const p of parts) {
        if (!p) continue
        const m = p.match(/^==([^=\n]+)==$/)
        children.push(
          m
            ? { type: 'mark', data: { hName: 'mark', hChildren: [{ type: 'text', value: m[1] }] } }
            : { type: 'text', value: p }
        )
      }
      parent.children.splice(index, 1, ...children)
      return index + children.length - 1
    })
  }
}

// CommonMark mewajibkan baris penutup code fence hanya berisi fence + spasi.
// Bila pengguna menulis teks di baris yang sama, mis. "``` ## Judul", baris itu
// dianggap isi kode sehingga sisa catatan (termasuk **bold**) ikut jadi kode dan
// tampil sebagai teks mentah. Normalisasi ini memisahkan fence penutup dari teks
// setelahnya agar tetap dirender. "```bash" tetap dianggap isi kode.
function normalizeFences(md) {
  const lines = String(md || '').split(/\r?\n/)
  const out = []
  let fenceChar = null
  let fenceLen = 0
  for (const line of lines) {
    if (fenceChar) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
        out.push(line)
        fenceChar = null
        continue
      }
      const trailing = line.match(/^ {0,3}(`{3,}|~{3,})([ \t]*)(\S.*)$/)
      if (
        trailing &&
        trailing[1][0] === fenceChar &&
        trailing[1].length >= fenceLen &&
        !/^[A-Za-z0-9_+.-]+$/.test(trailing[3].trim())
      ) {
        out.push(trailing[1])
        out.push(trailing[3])
        fenceChar = null
        continue
      }
      out.push(line)
      continue
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (open) {
      fenceChar = open[1][0]
      fenceLen = open[1].length
    }
    out.push(line)
  }
  return out.join('\n')
}

export default function Markdown({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMark]}
        rehypePlugins={[[rehypeHighlight, {
          detect: true,
          languages: highlightLanguages,
          aliases: highlightAliases,
        }]]}
        components={{
          img: ({ node: _node, ...props }) => <img {...props} src={authedImageUrl(props.src || '')} />,
        }}
      >
        {normalizeFences(content)}
      </ReactMarkdown>
    </div>
  )
}