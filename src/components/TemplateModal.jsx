import { LayoutTemplate, Server, Wrench, ListChecks, KeyRound, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/useApp'
import { templates } from '../data/templates'

const icons = {
  'template-server': Server,
  'template-troubleshooting': Wrench,
  'template-sop': ListChecks,
  'template-kredensial': KeyRound,
}

export default function TemplateModal() {
  const { tplOpen, setTplOpen, createNoteFromTemplate } = useApp()

  if (!tplOpen) return null

  return (
    <Modal onClose={() => setTplOpen(false)} width="max-w-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-sky-400" />
          <h3 className="text-[15px] font-semibold text-slate-100">Buat catatan dari template</h3>
        </div>
        <button
          onClick={() => setTplOpen(false)}
          className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        {templates.map((t) => {
          const Icon = icons[t.id] || LayoutTemplate
          return (
            <button
              key={t.id}
              onClick={() => createNoteFromTemplate(t)}
              className="group flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left transition-all hover:border-sky-700 hover:bg-sky-500/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 group-hover:bg-sky-500/20">
                <Icon className="h-4.5 w-4.5 text-sky-400" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-200 group-hover:text-sky-200">
                  {t.name}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{t.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-600">
        Template membuat catatan baru dengan struktur siap isi — kamu bisa langsung edit.
      </div>
    </Modal>
  )
}