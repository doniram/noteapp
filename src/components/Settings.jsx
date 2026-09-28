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
  HardDrive,
  Link2,
  Unlink,
} from 'lucide-react'
import { useApp } from '../context/useApp'

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40'
const softBtn =
  'flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
const primaryBtn =
  'flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40'

function EnableToggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-slate-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sky-500"
      />
      {label}
    </label>
  )
}

function Section({ icon: Icon, title, enabled, onToggle, children }) {
  const { t } = useApp()
  return (
    <section className="rounded-xl border border-slate-800/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
          <Icon className="h-4 w-4 text-sky-400" /> {title}
        </h3>
        <EnableToggle checked={enabled} onChange={onToggle} label={t('settings.enabled')} />
      </div>
      {children}
    </section>
  )
}

function ResultSummary({ result }) {
  const { t } = useApp()
  if (!result) return null
  if (!result.ok) return <div className="text-[12px] text-rose-400">{result.error || result.message}</div>
  return (
    <div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
        <span>{t('settings.uploadedCount', { n: result.uploaded || 0 })}</span>
        {!!result.moved && <span>{t('settings.moved', { n: result.moved })}</span>}
        {!!result.deleted && <span>{t('settings.deleted', { n: result.deleted })}</span>}
        {!!result.attachments && <span>{t('settings.attachmentCount', { n: result.attachments })}</span>}
      </div>
      {result.failed?.length > 0 && (
        <div className="mt-1 text-[12px] text-rose-400">
          {t('settings.failed', { n: result.failed.length })}
          <ul className="ml-4 list-disc">
            {result.failed.slice(0, 5).map((f, i) => (
              <li key={i}>
                {f.title}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const {
    setSettingsOpen,
    nextcloud,
    gdrive,
    saveNextcloud,
    testNextcloud,
    syncNextcloud,
    saveGdrive,
    testGdrive,
    startGdriveOAuth,
    disconnectGdrive,
    syncGdrive,
    providerSyncing,
    nextcloudSyncResult,
    gdriveSyncResult,
    notice,
    setNotice,
    t,
  } = useApp()

  const [ncEnabled, setNcEnabled] = useState(!!nextcloud?.enabled)
  const [server, setServer] = useState(nextcloud?.server || '')
  const [username, setUsername] = useState(nextcloud?.username || '')
  const [password, setPassword] = useState('')
  const [path, setPath] = useState(nextcloud?.path || 'DevNotes')
  const [showPw, setShowPw] = useState(false)

  const [gdEnabled, setGdEnabled] = useState(!!gdrive?.enabled)
  const [clientId, setClientId] = useState(gdrive?.clientId || '')
  const [clientSecret, setClientSecret] = useState('')
  const [folder, setFolder] = useState(gdrive?.folder || 'DevNotes')
  const [showSecret, setShowSecret] = useState(false)

  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const redirectUri = `${window.location.origin}/api/gdrive/oauth/callback`
  const ncSyncing = providerSyncing === 'webdav'
  const gdSyncing = providerSyncing === 'gdrive'

  const run = async (key, fn) => {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const onSaveNextcloud = (e) => {
    e.preventDefault()
    run('nc-save', async () => {
      await saveNextcloud({ enabled: ncEnabled, server: server.trim(), username: username.trim(), password, path: path.trim() })
      setPassword('')
      setMsg({ ok: true, text: t('settings.saved') })
    })
  }

  const onTestNextcloud = () =>
    run('nc-test', async () => {
      const r = await testNextcloud({ server: server.trim(), username: username.trim(), password, path: path.trim() })
      setMsg({ ok: true, text: r.message })
    })

  const onSyncNextcloud = async () => {
    setMsg(null)
    const r = await syncNextcloud()
    setMsg({ ok: r.ok, text: r.ok ? r.message : r.error })
  }

  const onSaveGdrive = (e) => {
    e.preventDefault()
    run('gd-save', async () => {
      await saveGdrive({ enabled: gdEnabled, clientId: clientId.trim(), clientSecret, folder: folder.trim() })
      setClientSecret('')
      setMsg({ ok: true, text: t('settings.saved') })
    })
  }

  const onTestGdrive = () =>
    run('gd-test', async () => {
      const r = await testGdrive({ clientId: clientId.trim(), clientSecret, folder: folder.trim() })
      setMsg({ ok: true, text: r.message })
    })

  const onConnectGdrive = () => run('gd-connect', () => startGdriveOAuth())

  const onDisconnectGdrive = () =>
    run('gd-disconnect', async () => {
      await disconnectGdrive()
      setNotice(null)
      setMsg({ ok: true, text: t('settings.gdriveDisconnected') })
    })

  const onSyncGdrive = async () => {
    setMsg(null)
    const r = await syncGdrive()
    setMsg({ ok: r.ok, text: r.ok ? r.message : r.error })
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 md:p-10">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-[#0d141d] shadow-2xl shadow-black/60">
          <div className="flex items-center gap-3 border-b border-slate-800/70 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600">
              <CloudCog className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-slate-100">{t('settings.title')}</h2>
              <p className="text-[12px] text-slate-500">{t('settings.subtitle')}</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              title={t('common.close')}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {notice && (
              <div
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${
                  notice.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <span className="flex-1">{notice.text}</span>
                <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Google Drive */}
            <Section
              icon={HardDrive}
              title={t('settings.gdrive')}
              enabled={gdEnabled}
              onToggle={setGdEnabled}
            >
              <form onSubmit={onSaveGdrive} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] text-slate-400">{t('settings.gdriveClientId')}</label>
                  <input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={!gdEnabled}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[12px] text-slate-400">
                    <Lock className="h-3 w-3" /> {t('settings.gdriveClientSecret')}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      disabled={!gdEnabled}
                      placeholder={
                        gdrive?.hasClientSecret && !clientSecret
                          ? t('settings.passwordSaved')
                          : t('settings.gdriveClientSecretPlaceholder')
                      }
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      disabled={!gdEnabled}
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 disabled:opacity-40"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[12px] text-slate-400">
                    <FolderInput className="h-3 w-3" /> {t('settings.gdriveFolder')}
                  </label>
                  <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    disabled={!gdEnabled}
                    placeholder="DevNotes"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-slate-400">{t('settings.gdriveRedirect')}</label>
                  <input readOnly value={redirectUri} className={inputCls + ' font-mono text-[11px]'} />
                  <p className="mt-1 text-[11px] text-slate-600">{t('settings.gdriveRedirectHint')}</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {gdrive?.connected ? (
                    <button
                      type="button"
                      onClick={onDisconnectGdrive}
                      disabled={!!busy}
                      className={softBtn + ' text-rose-400 hover:border-rose-500'}
                    >
                      {busy === 'gd-disconnect' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      {t('settings.gdriveDisconnect')}
                    </button>
                  ) : (
                    <button type="button" onClick={onConnectGdrive} disabled={!gdEnabled || !!busy} className={softBtn}>
                      {busy === 'gd-connect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                      {t('settings.gdriveConnect')}
                    </button>
                  )}
                  <button type="button" onClick={onTestGdrive} disabled={!gdEnabled || !!busy} className={softBtn}>
                    {busy === 'gd-test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {t('settings.test')}
                  </button>
                  <button type="submit" disabled={!!busy} className={primaryBtn + ' flex-1'}>
                    {busy === 'gd-save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('common.save')}
                  </button>
                </div>

                {gdrive?.connected && (
                  <p className="text-[11px] text-emerald-400">
                    {t('settings.gdriveConnectedAs', { email: gdrive.account || 'Google' })}
                  </p>
                )}
              </form>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
                <span className="text-[12px] text-slate-400">{t('settings.lastSync')}</span>
                <button
                  onClick={onSyncGdrive}
                  disabled={!gdEnabled || gdSyncing}
                  className={primaryBtn}
                >
                  {gdSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                  {gdSyncing ? t('settings.syncing') : t('settings.syncNow')}
                </button>
              </div>
              <div className="mt-2">
                <ResultSummary result={gdriveSyncResult} />
              </div>
            </Section>

            {/* Nextcloud */}
            <Section icon={CloudUpload} title={t('settings.webdav')} enabled={ncEnabled} onToggle={setNcEnabled}>
              <form onSubmit={onSaveNextcloud} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] text-slate-400">{t('settings.server')}</label>
                  <input
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    disabled={!ncEnabled}
                    placeholder="https://cloud.example.com"
                    inputMode="url"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-slate-400">{t('settings.username')}</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!ncEnabled}
                    placeholder={t('settings.usernamePlaceholder')}
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[12px] text-slate-400">
                    <Lock className="h-3 w-3" /> {t('settings.password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={!ncEnabled}
                      placeholder={
                        nextcloud?.hasPassword && !password
                          ? t('settings.passwordSaved')
                          : t('settings.passwordPlaceholder')
                      }
                      autoComplete="current-password"
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      disabled={!ncEnabled}
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 disabled:opacity-40"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[12px] text-slate-400">
                    <FolderInput className="h-3 w-3" /> {t('settings.folder')}
                  </label>
                  <input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    disabled={!ncEnabled}
                    placeholder="DevNotes"
                    className={inputCls}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={onTestNextcloud} disabled={!ncEnabled || !!busy} className={softBtn}>
                    {busy === 'nc-test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {t('settings.test')}
                  </button>
                  <button type="submit" disabled={!!busy} className={primaryBtn + ' flex-1'}>
                    {busy === 'nc-save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('common.save')}
                  </button>
                </div>
              </form>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
                <span className="text-[12px] text-slate-400">{t('settings.lastSync')}</span>
                <button onClick={onSyncNextcloud} disabled={!ncEnabled || ncSyncing} className={primaryBtn}>
                  {ncSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                  {ncSyncing ? t('settings.syncing') : t('settings.syncNow')}
                </button>
              </div>
              <div className="mt-2">
                <ResultSummary result={nextcloudSyncResult} />
              </div>
            </Section>

            {msg && (
              <div
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${
                  msg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {msg.ok && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
