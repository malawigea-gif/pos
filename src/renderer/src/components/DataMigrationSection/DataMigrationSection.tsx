import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { decodeIpcError } from '@shared/errors'
import type { DestinationTableCounts, MigrationRowCounts } from '@shared/migration'
import { useDescribeError } from '../../lib/ipcError'
import { Modal } from '../Modal/Modal'
import formStyles from '../Form/formStyles.module.css'
import styles from './DataMigrationSection.module.css'

/** One-time, admin-triggered import of an existing Standalone install's
 *  SQLite data into the server this till is now connected to — see
 *  sqliteToPostgresMigration.ts. Only meaningful once this till has
 *  already switched to Networked mode (that's what it's importing *into*),
 *  which is checked both here (for a clearer message than letting the
 *  button fail) and again on the main-process side (the actual guard). */
export function DataMigrationSection(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [isNetworked, setIsNetworked] = useState<boolean | null>(null)
  const [sourcePath, setSourcePath] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedByCounts, setBlockedByCounts] = useState<DestinationTableCounts | null>(null)
  const [results, setResults] = useState<MigrationRowCounts | null>(null)

  useEffect(() => {
    window.api.appConfig.get().then((config) => setIsNetworked(config.mode === 'networked'))
  }, [])

  async function handlePickFile(): Promise<void> {
    const path = await window.api.migration.pickSourceFile()
    if (path) {
      setSourcePath(path)
      setResults(null)
      setError(null)
      setBlockedByCounts(null)
    }
  }

  async function handleRun(): Promise<void> {
    if (!sourcePath) return
    setRunning(true)
    setError(null)
    setBlockedByCounts(null)
    setResults(null)
    try {
      setResults(await window.api.migration.run(sourcePath))
    } catch (err) {
      const decoded = decodeIpcError(err)
      if (decoded.code === 'MIGRATION_DESTINATION_NOT_EMPTY' && decoded.details) {
        setBlockedByCounts(decoded.details.tableCounts as DestinationTableCounts)
      }
      setError(describeError(err))
    } finally {
      setRunning(false)
      setConfirming(false)
    }
  }

  if (isNetworked === false) {
    return <p className={formStyles.hint}>{t('settings.dataMigration.needsNetworkedMode')}</p>
  }

  const blockedTables = blockedByCounts
    ? Object.entries(blockedByCounts).filter(([, count]) => count > 0)
    : []

  return (
    <>
      <p className={formStyles.hint}>{t('settings.dataMigration.description')}</p>

      <div className={styles.pickRow}>
        <button type="button" className={formStyles.buttonSecondary} onClick={handlePickFile}>
          {t('settings.dataMigration.chooseFile')}
        </button>
        {sourcePath && <span className={styles.filePath}>{sourcePath}</span>}
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {blockedTables.length > 0 && (
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>{t('settings.dataMigration.table')}</th>
              <th>{t('settings.dataMigration.existingRows')}</th>
            </tr>
          </thead>
          <tbody>
            {blockedTables.map(([table, count]) => (
              <tr key={table}>
                <td>{table}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {results && (
        <>
          <p className={formStyles.hint}>{t('settings.dataMigration.success')}</p>
          <table className={styles.resultsTable}>
            <thead>
              <tr>
                <th>{t('settings.dataMigration.table')}</th>
                <th>{t('settings.dataMigration.importedRows')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(results).map(([table, count]) => (
                <tr key={table}>
                  <td>{table}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <button
        type="button"
        className={formStyles.buttonPrimary}
        onClick={() => setConfirming(true)}
        disabled={!sourcePath || running}
      >
        {t('settings.dataMigration.run')}
      </button>

      {confirming && (
        <Modal
          title={t('settings.dataMigration.confirmTitle')}
          onClose={running ? () => undefined : () => setConfirming(false)}
          footer={
            <>
              <button
                type="button"
                className={formStyles.buttonSecondary}
                onClick={() => setConfirming(false)}
                disabled={running}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className={formStyles.buttonPrimary} onClick={handleRun} disabled={running}>
                {running ? t('settings.dataMigration.running') : t('settings.dataMigration.confirm')}
              </button>
            </>
          }
        >
          <p className={styles.filePath}>{sourcePath}</p>
          <p>{t('settings.dataMigration.confirmWarning')}</p>
        </Modal>
      )}
    </>
  )
}
