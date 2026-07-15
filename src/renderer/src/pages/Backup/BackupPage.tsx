import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BackupFileInfo, BackupSettings } from '@shared/backup'
import { useDescribeError } from '../../lib/ipcError'
import { formatDateTime } from '../../lib/format'
import type { SupportedLanguage } from '../../i18n'
import { RestoreConfirmModal } from './RestoreConfirmModal'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import formStyles from '../../components/Form/formStyles.module.css'
import tableStyles from '../../components/DataTable/dataTable.module.css'
import pageStyles from '../../components/TabbedPage/tabbedPage.module.css'
import styles from './BackupPage.module.css'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const describeError = useDescribeError()
  const lang = i18n.language as SupportedLanguage

  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [folder, setFolder] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(true)
  const [intervalHours, setIntervalHours] = useState('24')
  const [retentionCount, setRetentionCount] = useState('14')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [backups, setBackups] = useState<BackupFileInfo[]>([])
  const [loadingBackups, setLoadingBackups] = useState(true)
  const [runningBackup, setRunningBackup] = useState(false)
  const [backupNowMessage, setBackupNowMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ filePath: string; fileName: string } | null>(null)

  async function loadSettings(): Promise<void> {
    const s = await window.api.backup.getSettings()
    setSettings(s)
    setFolder(s.folder)
    setAutoEnabled(s.autoEnabled)
    setIntervalHours(String(s.intervalHours))
    setRetentionCount(String(s.retentionCount))
  }

  async function loadBackups(): Promise<void> {
    setLoadingBackups(true)
    try {
      setBackups(await window.api.backup.list())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoadingBackups(false)
    }
  }

  useEffect(() => {
    loadSettings().catch((err) => setError(describeError(err)))
    loadBackups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleChooseFolder(): Promise<void> {
    const chosen = await window.api.backup.pickFolder()
    if (chosen) setFolder(chosen)
  }

  async function handleSaveSettings(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSavingSettings(true)
    setError(null)
    setSettingsSaved(false)
    try {
      const updated = await window.api.backup.updateSettings({
        folder,
        autoEnabled,
        intervalHours: Number(intervalHours) || 1,
        retentionCount: Number(retentionCount) || 1
      })
      setSettings(updated)
      setSettingsSaved(true)
      await loadBackups()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleBackupNow(): Promise<void> {
    setRunningBackup(true)
    setError(null)
    setBackupNowMessage(null)
    try {
      const info = await window.api.backup.runNow()
      setBackupNowMessage(t('backup.actions.backupNowSuccess', { fileName: info.fileName }))
      await loadSettings()
      await loadBackups()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setRunningBackup(false)
    }
  }

  async function handleOpenFolder(): Promise<void> {
    try {
      await window.api.backup.openFolder()
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleRestoreFromFile(): Promise<void> {
    const filePath = await window.api.backup.pickRestoreFile()
    if (!filePath) return
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath
    setRestoreTarget({ filePath, fileName })
  }

  return (
    <div className={pageStyles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.backup } as React.CSSProperties}>
      <h1 className={pageStyles.title}>{t('backup.title')}</h1>

      {error && <div className={formStyles.error}>{error}</div>}

      <form className={styles.section} onSubmit={handleSaveSettings}>
        <h2 className={styles.sectionTitle}>{t('backup.settings.sectionTitle')}</h2>

        {settingsSaved && <div className={tableStyles.statusNotice}>{t('backup.settings.saved')}</div>}

        <div className={styles.folderRow}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('backup.settings.folder')}</label>
            <input className={formStyles.input} value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
          <button type="button" className={formStyles.buttonSecondary} onClick={handleChooseFolder}>
            {t('backup.settings.chooseFolder')}
          </button>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="backup-auto-enabled"
            type="checkbox"
            checked={autoEnabled}
            onChange={(e) => setAutoEnabled(e.target.checked)}
          />
          <label htmlFor="backup-auto-enabled">{t('backup.settings.autoEnabled')}</label>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('backup.settings.intervalHours')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="1"
              value={intervalHours}
              onChange={(e) => setIntervalHours(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>
              {t('backup.settings.retentionCount')} ({t('backup.settings.retentionCountSuffix')})
            </label>
            <input
              className={formStyles.input}
              type="number"
              min="1"
              value={retentionCount}
              onChange={(e) => setRetentionCount(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className={formStyles.buttonPrimary} disabled={savingSettings}>
          {t('backup.settings.save')}
        </button>
      </form>

      <div className={styles.statusRow}>
        <span className={styles.statusText}>
          {settings?.lastBackupAt
            ? t('backup.status.lastBackup', { date: formatDateTime(new Date(settings.lastBackupAt), lang) })
            : t('backup.status.lastBackupNever')}
        </span>
        <div className={styles.actionsRow}>
          <button type="button" className={formStyles.buttonSecondary} onClick={handleOpenFolder}>
            {t('backup.actions.openFolder')}
          </button>
          <button type="button" className={formStyles.buttonSecondary} onClick={handleRestoreFromFile}>
            {t('backup.actions.restoreFromFile')}
          </button>
          <button
            type="button"
            className={formStyles.buttonPrimary}
            onClick={handleBackupNow}
            disabled={runningBackup}
          >
            {t('backup.actions.backupNow')}
          </button>
        </div>
      </div>

      {backupNowMessage && <div className={tableStyles.statusNotice}>{backupNowMessage}</div>}

      <h2 className={styles.sectionTitle}>{t('backup.history.title')}</h2>

      {loadingBackups ? (
        <p>{t('common.loading')}</p>
      ) : backups.length === 0 ? (
        <p>{t('backup.history.noResults')}</p>
      ) : (
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>{t('backup.history.table.fileName')}</th>
              <th>{t('backup.history.table.size')}</th>
              <th>{t('backup.history.table.createdAt')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.filePath}>
                <td>{backup.fileName}</td>
                <td>{formatBytes(backup.sizeBytes)}</td>
                <td>{formatDateTime(new Date(backup.createdAt), lang)}</td>
                <td className={tableStyles.actionsCell}>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget({ filePath: backup.filePath, fileName: backup.fileName })}
                  >
                    {t('backup.history.restore')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {restoreTarget && (
        <RestoreConfirmModal
          filePath={restoreTarget.filePath}
          fileName={restoreTarget.fileName}
          onClose={() => setRestoreTarget(null)}
        />
      )}
    </div>
  )
}
