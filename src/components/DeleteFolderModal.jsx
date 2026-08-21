import { useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/useApp'

export default function DeleteFolderModal() {
  const { folderToDelete, setFolderToDelete, deleteFolder } = useApp()
  const [typed, setTyped] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  if (!folderToDelete) return null

  const name = folderToDelete.name
  const match = typed === name
  const ready = match && confirmed

  const close = () => {
    setFolderToDelete(null)
    setTyped('')
    setConfirmed(false)
  }

  const onConfirm = () => {
    deleteFolder(folderToDelete.id)
  }

  return (
    <Modal onClose={close} width="max-w-md">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <h3 className="text-[15px] font-semibold text-slate-100">Hapus folder</h3>
        </div>
        <button
          onClick={close}
          className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        <p className="text-[13px] text-slate-300">
          Anda akan menghapus folder{' '}
          <span className="font-semibold text-rose-300">"{name}"</span>. Catatan di dalamnya akan
          dipindah ke <em>Tanpa folder</em>. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
        </p>

        <label className="mb-1.5 mt-4 block text-[12px] font-medium text-slate-400">
          Ketik nama folder untuk melanjutkan
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={name}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[14px] text-slate-200 placeholder:text-slate-600 focus:border-rose-700 focus:outline-none"
        />
        {typed.length > 0 && !match && (
          <div className="mt-1 text-[11px] text-rose-400">Nama tidak cocok</div>
        )}

        <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-rose-600"
          />
          <span className="text-[12px] text-slate-400">
            Saya paham dan menyetujui penghapusan folder{' '}
            <span className="text-slate-300">"{name}"</span>.
          </span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
        <button
          onClick={close}
          className="rounded-lg px-3 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          disabled={!ready}
          className="flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hapus folder
        </button>
      </div>
    </Modal>
  )
}
