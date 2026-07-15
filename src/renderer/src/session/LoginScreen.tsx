import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n'
import { useDescribeError } from '../lib/ipcError'
import formStyles from '../components/Form/formStyles.module.css'
import styles from './LoginScreen.module.css'

interface LoginScreenProps {
  onLoggedIn: () => void
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const describeError = useDescribeError()
  const activeLanguage = i18n.language as SupportedLanguage

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await window.api.session.login({ username: username.trim(), password })
      onLoggedIn()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
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

      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{t('common.appName')}</h1>
        <h2 className={styles.subtitle}>{t('session.login.title')}</h2>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('session.login.username')}</label>
          <input
            className={formStyles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('session.login.password')}</label>
          <input
            className={formStyles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className={formStyles.buttonPrimary} disabled={submitting}>
          {t('session.login.submit')}
        </button>
      </form>
    </div>
  )
}
