import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StartupStatus } from '@shared/appConfig'
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n'
import { ServerConnectionForm } from '../components/ServerConnectionForm/ServerConnectionForm'
import formStyles from '../components/Form/formStyles.module.css'
import styles from './ServerUnreachableScreen.module.css'

interface ServerUnreachableScreenProps {
  status: StartupStatus
}

/** Shown instead of the normal login/app shell when this till starts up in
 *  Networked mode and can't reach the configured Postgres server at all —
 *  wrong IP, server down, firewall, etc. There is deliberately no session
 *  and no database behind this screen (that's the whole problem), so
 *  "Fix connection settings" reuses ServerConnectionForm's unguarded
 *  appConfig:* IPC channels rather than anything that assumes a logged-in
 *  admin. "Retry" is just a full relaunch — the same boot sequence runs
 *  again and either succeeds or lands back here with a fresh error. */
export function ServerUnreachableScreen({ status }: ServerUnreachableScreenProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const activeLanguage = i18n.language as SupportedLanguage
  const [showSettings, setShowSettings] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function handleRetry(): Promise<void> {
    setRetrying(true)
    await window.api.appConfig.relaunch()
  }

  return (
    <div className={styles.page}>
      <div className={styles.languageSwitcher} role="radiogroup" aria-label={t('topbar.language')}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={activeLanguage === lang}
            className={activeLanguage === lang ? styles.langButtonActive : styles.langButton}
            onClick={() => setLanguage(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>{t('common.appName')}</h1>
        <h2 className={styles.subtitle}>{t('session.serverUnreachable.title')}</h2>
        <p className={styles.description}>{t('session.serverUnreachable.description')}</p>

        {status.error && (
          <details className={styles.details}>
            <summary>{t('session.serverUnreachable.technicalDetails')}</summary>
            <p>{status.error}</p>
          </details>
        )}

        {showSettings ? (
          <ServerConnectionForm />
        ) : (
          <div className={styles.actions}>
            <button type="button" className={formStyles.buttonPrimary} onClick={handleRetry} disabled={retrying}>
              {t('session.serverUnreachable.retry')}
            </button>
            <button type="button" className={formStyles.buttonSecondary} onClick={() => setShowSettings(true)}>
              {t('session.serverUnreachable.fixSettings')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
