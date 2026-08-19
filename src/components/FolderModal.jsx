import { useState } from 'react'
import { Folder, FolderPlus, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/useApp'

export default function FolderModal() {
  const { folderModal, setFolderModal, createFolder, folders } = useApp()
  const [name, setName] = useState('')

  if (!folderModal) return null

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    createFolder(n)
    setName('')
  }

  return (
    <Modal onClose={() => setFolderModal(false)} width="max-w-sm">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-sky-400" />
            <h3 className="text-[15px] font-semibold text-slate-100">Folder baru</h3>
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
            Buat folder
          </button>
        </div>
      </form>
    </Modal>
  )
}