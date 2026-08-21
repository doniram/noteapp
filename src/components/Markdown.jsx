import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { authedImageUrl } from '../api'

export default function Markdown({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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