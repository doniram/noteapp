import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { visit } from 'unist-util-visit'
import { authedImageUrl } from '../api'

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

export default function Markdown({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMark]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          img: ({ node: _node, ...props }) => <img {...props} src={authedImageUrl(props.src || '')} />,
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}