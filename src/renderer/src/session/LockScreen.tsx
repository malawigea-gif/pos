import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDescribeError } from '../lib/ipcError'
import formStyles from '../components/Form/formStyles.module.css'
import styles from './LoginScreen.module.css'

interface LockScreenProps {
  fullName: string
  onUnlocked: () => void
}

export function LockScreen({ fullName, onUnlocked }: LockScreenProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await window.api.session.unlock(password)
      onUnlocked()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{t('session.lock.title')}</h1>
        <h2 className={styles.subtitle}>{fullName}</h2>

        {error && <div className={formStyles.error}>{error}</div>}

        <p className={formStyles.hint}>{t('session.lock.message')}</p>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('session.login.password')}</label>
          <input
            className={formStyles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        <button type="submit" className={formStyles.buttonPrimary} disabled={submitting}>
          {t('session.lock.unlock')}
        </button>
      </form>
    </div>
  )
}
