import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReportColumn, ReportTableSpec } from '@shared/reports'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

interface ReportTableProps {
  title: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  totals?: Record<string, string | number>
  loading?: boolean
  note?: string
}

export function ReportTable({ title, columns, rows, totals, loading, note }: ReportTableProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function buildSpec(): ReportTableSpec {
    return { title, generatedAt: new Date().toLocaleString(), columns, rows, totals }
  }

  async function handleExportPdf(): Promise<void> {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const path = await window.api.reports.exportPdf(buildSpec())
      if (path) setStatus(t('reports.pdfSaved', { path }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleExportExcel(): Promise<void> {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const path = await window.api.reports.exportExcel(buildSpec())
      if (path) setStatus(t('reports.excelSaved', { path }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      {status && <div className={styles.statusNotice}>{status}</div>}
      {note && <p className={formStyles.hint}>{note}</p>}

      <div className={styles.toolbar}>
        <button type="button" className={formStyles.buttonSecondary} onClick={handleExportPdf} disabled={busy}>
          {t('reports.exportPdf')}
        </button>
        <button type="button" className={formStyles.buttonSecondary} onClick={handleExportExcel} disabled={busy}>
          {t('reports.exportExcel')}
        </button>
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p>{t('reports.noData')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr className={styles.totalsRow}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {totals[c.key]}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
