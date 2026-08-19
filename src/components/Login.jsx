import { useState } from 'react'
import { StickyNote, LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../context/useApp'

export default function Login() {
  const { login, register } = useApp()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(username.trim(), password)
      else await register(username.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-[14px] text-slate-200 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none'

  return (
    <div className="flex h-full items-center justify-center bg-[#0b0f14] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-950">
            <StickyNote className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">DevNotes</h1>
            <p className="mt-1 text-[13px] text-slate-500">Dokumentasi teknis & catatan operasional</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d141d] p-6 shadow-2xl shadow-black/40">
          <div className="mb-5 flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
            {(['login', 'register']).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  mode === m
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'login' ? (
                  <LogIn className="h-3.5 w-3.5" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {m === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-400">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: admin"
                autoComplete="username"
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-400">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="minimal 6 karakter"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

            {error && (
              <div className="rounded-lg border border-rose-800/70 bg-rose-950/60 px-3 py-2 text-[12px] text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Masuk' : 'Buat Akun'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="mt-4 text-center text-[12px] text-slate-600">
              Akun demo: <span className="font-mono text-slate-400">admin</span> /{' '}
              <span className="font-mono text-slate-400">admin123</span>
            </p>
          )}
          {mode === 'register' && (
            <p className="mt-4 text-center text-[12px] text-slate-600">
              Pendaftaran otomatis membuat workspace baru.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}