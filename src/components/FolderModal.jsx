import { useState } from 'react'
import {
  Folder,
  FolderPlus,
  Server,
  Database,
  Network,
  Terminal,
  FileText,
  Cloud,
  Shield,
  Settings,
  Globe,
  HardDrive,
  Layers,
  Pencil,
  X,
} from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/useApp'

const ICONS = [
  { key: 'folder', Icon: Folder, color: 'text-slate-400' },
  { key: 'server', Icon: Server, color: 'text-sky-400' },
  { key: 'database', Icon: Database, color: 'text-cyan-400' },
  { key: 'network', Icon: Network, color: 'text-violet-400' },
  { key: 'terminal', Icon: Terminal, color: 'text-rose-400' },
  { key: 'file', Icon: FileText, color: 'text-amber-400' },
  { key: 'cloud', Icon: Cloud, color: 'text-sky-300' },
  { key: 'shield', Icon: Shield, color: 'text-emerald-400' },
  { key: 'gear', Icon: Settings, color: 'text-slate-300' },
  { key: 'globe', Icon: Globe, color: 'text-blue-400' },
  { key: 'drive', Icon: HardDrive, color: 'text-amber-300' },
  { key: 'layers', Icon: Layers, color: 'text-purple-300' },
]

export default function FolderModal() {
  const {
    folderModal,
    setFolderModal,
    createFolder,
    updateFolder,
    folderModalTarget,
    folders,
  } = useApp()

  const editing = !!folderModalTarget
  const [name, setName] = useState(folderModalTarget?.name ?? '')
  const [icon, setIcon] = useState(folderModalTarget?.icon || 'folder')

  if (!folderModal) return null

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    if (editing) updateFolder(folderModalTarget.id, { name: n, icon })
    else createFolder(n, icon)
  }

  return (
    <Modal onClose={() => setFolderModal(false)} width="max-w-sm">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            {editing ? (
              <Pencil className="h-4 w-4 text-sky-400" />
            ) : (
              <FolderPlus className="h-4 w-4 text-sky-400" />
            )}
            <h3 className="text-[15px] font-semibold text-slate-100">
              {editing ? 'Ubah folder' : 'Folder baru'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setFolderModal(false)}
            className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <label className="mb-1.5 block text-[12px] font-medium text-slate-400">
            Nama folder <span className="text-slate-600">({folders.length} folder)</span>
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 focus-within:border-sky-700">
            <Folder className="h-4 w-4 text-slate-600" />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="misal: Production Servers"
              className="w-full bg-transparent text-[14px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          <label className="mb-1.5 mt-4 block text-[12px] font-medium text-slate-400">
            Ikon folder
          </label>
          <div className="grid grid-cols-6 gap-2">
            {ICONS.map(({ key, Icon, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                title={key}
                className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
                  icon === key
                    ? 'border-sky-600 bg-sky-500/15'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <Icon className={`h-4 w-4 ${icon === key ? 'text-sky-300' : color}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={() => setFolderModal(false)}
            className="rounded-lg px-3 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? 'Simpan' : 'Buat folder'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
