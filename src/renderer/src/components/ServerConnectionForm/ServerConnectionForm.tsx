import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppConfig, ConnectionTestResult, DatabaseMode, NetworkedDbConfig } from '@shared/appConfig'
import formStyles from '../Form/formStyles.module.css'
import styles from './ServerConnectionForm.module.css'

const DEFAULT_NETWORKED: NetworkedDbConfig = { host: '', port: 5432, database: '', user: '', password: '' }
const MODES: DatabaseMode[] = ['standalone', 'networked']

/** Shared by two very different callers: the admin-only Server Connection
 *  section on SettingsPage (a logged-in admin, DB reachable) and
 *  ServerUnreachableScreen (no session, no DB — the whole reason this form
 *  needs to exist there). Both just need the same read-config / edit /
 *  test / save / prompt-to-restart flow, so it isn't duplicated. */
export function ServerConnectionForm(): JSX.Element {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<DatabaseMode>('standalone')
  const [fields, setFields] = useState<NetworkedDbConfig>(DEFAULT_NETWORKED)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNeedsRestart, setSavedNeedsRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    window.api.appConfig.get().then((config) => {
      setMode(config.mode)
      if (config.mode === 'networked') setFields(config.networked)
      setLoading(false)
    })
  }, [])

  function updateField<K extends keyof NetworkedDbConfig>(key: K, value: NetworkedDbConfig[K]): void {
    setFields((f) => ({ ...f, [key]: value }))
    setTestResult(null)
    setSavedNeedsRestart(false)
  }

  async function handleTestConnection(): Promise<void> {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await window.api.appConfig.testConnection(fields))
    } finally {
      setTesting(false)
    }
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    try {
      const config: AppConfig = mode === 'standalone' ? { mode: 'standalone' } : { mode: 'networked', networked: fields }
      await window.api.appConfig.set(config)
      setSavedNeedsRestart(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestart(): Promise<void> {
    setRestarting(true)
    await window.api.appConfig.relaunch()
  }

  if (loading) return <p className={formStyles.hint}>{t('common.loading')}</p>

  return (
    <form onSubmit={handleSave}>
      <div
        className={styles.modeOptions}
        role="radiogroup"
        aria-label={t('settings.serverConnection.mode.label')}
      >
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? formStyles.buttonPrimary : formStyles.buttonSecondary}
            onClick={() => {
              setMode(m)
              setSavedNeedsRestart(false)
            }}
          >
            {t(`settings.serverConnection.mode.${m}`)}
          </button>
        ))}
      </div>

      {mode === 'networked' && (
        <>
          <div className={formStyles.row}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('settings.serverConnection.host')}</label>
              <input
                className={formStyles.input}
                value={fields.host}
                onChange={(e) => updateField('host', e.target.value)}
                placeholder="192.168.1.10"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('settings.serverConnection.port')}</label>
              <input
                className={formStyles.input}
                type="number"
                value={fields.port}
                onChange={(e) => updateField('port', Number(e.target.value))}
              />
            </div>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('settings.serverConnection.database')}</label>
            <input
              className={formStyles.input}
              value={fields.database}
              onChange={(e) => updateField('database', e.target.value)}
            />
          </div>
          <div className={formStyles.row}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('settings.serverConnection.user')}</label>
              <input
                className={formStyles.input}
                value={fields.user}
                onChange={(e) => updateField('user', e.target.value)}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('settings.serverConnection.password')}</label>
              <input
                className={formStyles.input}
                type="password"
                value={fields.password}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          </div>

          {testResult && (
            <div className={testResult.ok ? styles.testSuccess : formStyles.error}>
              {testResult.ok ? t('settings.serverConnection.testSuccess') : testResult.message}
            </div>
          )}

          <button
            type="button"
            className={formStyles.buttonSecondary}
            onClick={handleTestConnection}
            disabled={testing || !fields.host || !fields.database || !fields.user}
          >
            {testing ? t('settings.serverConnection.testing') : t('settings.serverConnection.testConnection')}
          </button>
        </>
      )}

      {savedNeedsRestart && (
        <div className={styles.restartPrompt}>
          <p>{t('settings.serverConnection.restartPrompt')}</p>
          <button type="button" className={formStyles.buttonPrimary} onClick={handleRestart} disabled={restarting}>
            {t('settings.serverConnection.restartNow')}
          </button>
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" className={formStyles.buttonPrimary} disabled={saving}>
          {t('settings.serverConnection.save')}
        </button>
      </div>
    </form>
  )
}
