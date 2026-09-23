import { useState } from 'react'
import { StickyNote, Lock, Eye, EyeOff, Loader2, Unlock, LogOut } from 'lucide-react'
import { useApp } from '../context/useApp'

export default function LockScreen() {
  const { unlock, logout, t } = useApp()
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await unlock(pin)
    } catch (err) {
      setError(err.message || t('lock.wrongPin'))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-[14px] text-slate-200 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0b0f14] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-950">
            <StickyNote className="h-7 w-7 text-white" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-800 bg-[#0d141d]">
              <Lock className="h-3 w-3 text-amber-400" />
            </span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">{t('lock.title')}</h1>
            <p className="mt-1 text-[13px] text-slate-500">{t('lock.desc')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d141d] p-6 shadow-2xl shadow-black/40">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-400">{t('lock.pin')}</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={t('lock.pinPlaceholder')}
                  autoComplete="off"
                  autoFocus
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              disabled={busy || !pin}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              {t('lock.unlock')}
            </button>
          </form>

          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 px-4 py-2 text-[12px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('lock.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}
