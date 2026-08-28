import { useState } from 'react'
import { Tag, X, Check } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/useApp'

const COLORS = ['#22c55e', '#eab308', '#38bdf8', '#ef4444', '#a78bfa', '#f472b6', '#f97316', '#14b8a6']

export default function TagModal() {
  const { tagModal, setTagModal, createTag, tags, t } = useApp()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  if (!tagModal) return null

  const existing = name.trim()
    ? tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase())
    : undefined

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || existing) return
    createTag(n, color)
    setName('')
    setColor(COLORS[0])
    setTagModal(false)
  }

  return (
    <Modal onClose={() => setTagModal(false)} width="max-w-sm">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-sky-400" />
            <h3 className="text-[15px] font-semibold text-slate-100">{t('tag.new')}</h3>
          </div>
          <button
            type="button"
            onClick={() => setTagModal(false)}
            className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-400">
              {t('tag.name')} <span className="text-slate-600">{t('tag.count', { n: tags.length })}</span>
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 focus-within:border-sky-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('tag.placeholder')}
                className="w-full bg-transparent text-[14px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            {existing && (
              <div className="mt-1.5 text-[11px] text-amber-400">
                {t('tag.exists', { name: existing.name })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-400">{t('tasks.color')}</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-[#0d141d]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={() => setTagModal(false)}
            className="rounded-lg px-3 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !!existing}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('tag.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}