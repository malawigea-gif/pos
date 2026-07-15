import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './BackupPage.module.css'

interface RestoreConfirmModalProps {
  filePath: string
  fileName: string
  onClose: () => void
}

export function RestoreConfirmModal({ filePath, fileName, onClose }: RestoreConfirmModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [restoring, setRestoring] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setRestoring(true)
    setError(null)
    try {
      await window.api.backup.restore(filePath)
      setRestarting(true)
    } catch (err) {
      setError(describeError(err))
      setRestoring(false)
    }
  }

  return (
    <Modal
      title={t('backup.restoreConfirm.title')}
      onClose={restarting ? () => undefined : onClose}
      footer={
        !restarting && (
          <>
            <button type="button" className={formStyles.buttonSecondary} onClick={onClose} disabled={restoring}>
              {t('common.cancel')}
            </button>
            <button type="button" className={formStyles.buttonPrimary} onClick={handleConfirm} disabled={restoring}>
              {t('backup.restoreConfirm.confirm')}
            </button>
          </>
        )
      }
    >
      {error && <div className={formStyles.error}>{error}</div>}
      {restarting ? (
        <p>{t('backup.restoreConfirm.restarting')}</p>
      ) : (
        <p className={styles.warning}>{t('backup.restoreConfirm.warning', { fileName })}</p>
      )}
    </Modal>
  )
}
