import { useState } from 'react'
import {
  X,
  Save,
  Check,
  Loader2,
  PlugZap,
  CloudCog,
  CloudUpload,
  Eye,
  EyeOff,
  FolderInput,
  Lock,
} from 'lucide-react'
import { useApp } from '../context/useApp'

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none'

export default function Settings() {
  const {
    setSettingsOpen,
    nextcloud,
    saveNextcloud,
    testNextcloud,
    syncNextcloud,
    syncing,
    syncResult,
  } = useApp()

  const [server, setServer] = useState(nextcloud?.server || '')
  const [username, setUsername] = useState(nextcloud?.username || '')
  const [password, setPassword] = useState('')
  const [path, setPath] = useState(nextcloud?.path || 'DevNotes')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(null) // 'test' | 'save' | 'sync'
  const [msg, setMsg] = useState(null) // { ok, text }

  const cfg = () => ({ server: server.trim(), username: username.trim(), password, path: path.trim() })

  const onSave = async (e) => {
    e.preventDefault()
    setBusy('save')
    setMsg(null)
    try {
      await saveNextcloud(cfg())
      setPassword('')
      setMsg({ ok: true, text: 'Pengaturan WebDAV disimpan' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const onTest = async () => {
    setBusy('test')
    setMsg(null)
    try {
      const r = await testNextcloud(cfg())
      setMsg({ ok: true, text: r.message })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const onSync = async () => {
    setBusy('sync')
    setMsg(null)
    try {
      const r = await syncNextcloud()
      setMsg({ ok: r.ok, text: r.ok ? r.message : r.error })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 md:p-10">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-[#0d141d] shadow-2xl shadow-black/60">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-800/70 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600">
              <CloudCog className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold tracking-tight text-slate-100">Pengaturan</h2>
              <p className="text-[12px] text-slate-500">Sinkronisasi & integrasi</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              title="Tutup"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-5 px-5 py-5">
            <div>
              <h3 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-slate-200">
                <CloudUpload className="h-4 w-4 text-sky-400" /> Sinkronisasi Nextcloud (WebDAV)
              </h3>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Semua catatan (.md) akan diunggah otomatis ke folder{' '}
                <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[11px] text-sky-400">
                  /{path || 'DevNotes'}
                </code>{' '}
                di server Nextcloud Anda saat tombol Sinkron ditekan.
              </p>
            </div>

            <form onSubmit={onSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-400">
                  URL Server Nextcloud
                </label>
                <input
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="https://cloud.example.com"
                  inputMode="url"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-400">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username nextcloud"
                  autoComplete="username"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[12px] font-medium text-slate-400">
                  <Lock className="h-3 w-3" /> Password (App Password disarankan)
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      nextcloud?.hasPassword && !password ? '•••••••• (tersimpan)' : 'password'
                    }
                    autoComplete="current-password"
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[12px] font-medium text-slate-400">
                  <FolderInput className="h-3 w-3" /> Folder tujuan di Nextcloud
                </label>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="DevNotes"
                  className={inputCls}
                />
              </div>

              {msg && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                    msg.ok
                      ? 'border-emerald-800/70 bg-emerald-950/60 text-emerald-300'
                      : 'border-rose-800/70 bg-rose-950/60 text-rose-300'
                  }`}
                >
                  {msg.ok && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onTest}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
                >
                  {busy === 'test' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlugZap className="h-3.5 w-3.5" />
                  )}
                  Tes Koneksi
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                >
                  {busy === 'save' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Simpan
                </button>
              </div>
            </form>

            {/* Last sync */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-300">Sinkronisasi Terakhir</span>
                <button
                  onClick={onSync}
                  disabled={busy || syncing}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                >
                  {busy === 'sync' || syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="h-3.5 w-3.5" />
                  )}
                  {syncing || busy === 'sync' ? 'Menyinkronkan...' : 'Sinkron Sekarang'}
                </button>
              </div>
              {syncResult ? (
                <div className="text-[12px] leading-relaxed text-slate-400">
                  {syncResult.ok ? (
                    <>
                      <span className="text-emerald-400">{syncResult.message}</span>
                      {syncResult.failed?.length > 0 && (
                        <div className="mt-1 text-rose-400">
                          {syncResult.failed.length} file gagal:
                          <ul className="ml-4 list-disc">
                            {syncResult.failed.slice(0, 5).map((f, i) => (
                              <li key={i}>
                                {f.title}: {f.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-rose-400">{syncResult.error || syncResult.message}</span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-600">
                  Belum ada sinkronisasi. Simpan konfigurasi lalu tekan "Sinkron Sekarang" atau
                  tombol Sinkron di pojok kiri bawah.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}