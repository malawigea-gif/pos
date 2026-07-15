import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppLanguage, SafeUser, UserRole } from '@shared/users'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface UserFormModalProps {
  mode: 'create' | 'edit'
  user?: SafeUser
  onClose: () => void
  onSaved: () => void
}

export function UserFormModal({ mode, user, onClose, onSaved }: UserFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'cashier')
  const [language, setLanguage] = useState<AppLanguage>(user?.language ?? 'en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!fullName.trim()) {
      setError(t('users.fullNameRequired'))
      return
    }
    if (mode === 'create' && (!username.trim() || !password)) {
      setError(t('users.usernamePasswordRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        await window.api.users.create({
          username: username.trim(),
          password,
          fullName: fullName.trim(),
          role,
          language
        })
      } else if (user) {
        await window.api.users.update(user.id, { fullName: fullName.trim(), role, language })
      }
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? t('users.add') : t('users.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="user-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('users.username')}</label>
          <input
            className={formStyles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={mode === 'edit'}
            autoFocus={mode === 'create'}
          />
        </div>

        {mode === 'create' && (
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('users.password')}</label>
            <input
              className={formStyles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('users.fullName')}</label>
          <input
            className={formStyles.input}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus={mode === 'edit'}
          />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('users.role')}</label>
            <select className={formStyles.select} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="admin">{t('users.roles.admin')}</option>
              <option value="manager">{t('users.roles.manager')}</option>
              <option value="cashier">{t('users.roles.cashier')}</option>
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('users.language')}</label>
            <select
              className={formStyles.select}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            >
              <option value="en">{t('settings.language.english')}</option>
              <option value="si">{t('settings.language.sinhala')}</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  )
}
