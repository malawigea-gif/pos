import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SafeUser } from '@shared/users'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface ResetPasswordModalProps {
  user: SafeUser
  onClose: () => void
  onSaved: () => void
}

export function ResetPasswordModal({ user, onClose, onSaved }: ResetPasswordModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!newPassword) return

    setSaving(true)
    setError(null)
    try {
      await window.api.users.resetPassword(user.id, newPassword)
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('users.resetPasswordTitle', { name: user.full_name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="reset-password-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('users.resetPassword')}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('users.newPassword')}</label>
          <input
            className={formStyles.input}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
        </div>
      </form>
    </Modal>
  )
}
