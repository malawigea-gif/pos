import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterCashSummary, RegisterClosing } from '@shared/sales'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './RegisterClosingTab.module.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RegisterClosingTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [businessDate, setBusinessDate] = useState(today())
  const [summary, setSummary] = useState<RegisterCashSummary | null>(null)
  const [openingFloat, setOpeningFloat] = useState('0')
  const [countedCash, setCountedCash] = useState('0')
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState<RegisterClosing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.register.summary(businessDate).then(setSummary)
  }, [businessDate])

  useEffect(() => {
    window.api.register.list().then(setHistory)
  }, [])

  const expectedCash = (summary?.cashSalesTotal ?? 0) + (Number(openingFloat) || 0)
  const variance = (Number(countedCash) || 0) - expectedCash

  async function handleClose(): Promise<void> {
    const confirmed = window.confirm(t('register.confirmClose', { date: businessDate }))
    if (!confirmed) return

    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await window.api.register.close({
        businessDate,
        openingFloat: Number(openingFloat) || 0,
        countedCash: Number(countedCash) || 0,
        notes: notes.trim() || undefined
      })
      setStatus(t('register.close'))
      setHistory(await window.api.register.list())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        {error && <div className={formStyles.error}>{error}</div>}
        {status && <div className={styles.status}>{status}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('register.businessDate')}</label>
          <input
            className={formStyles.input}
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('register.openingFloat')}</label>
          <input
            className={formStyles.input}
            type="number"
            step="0.01"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </div>

        <div className={styles.readout}>
          <span>{t('register.cashSales')}</span>
          <span>{(summary?.cashSalesTotal ?? 0).toFixed(2)}</span>
        </div>
        <div className={styles.readout}>
          <span>{t('register.nonCashSales')}</span>
          <span>{(summary?.nonCashSalesTotal ?? 0).toFixed(2)}</span>
        </div>
        <div className={styles.readout}>
          <span>{t('register.expectedCash')}</span>
          <span>{expectedCash.toFixed(2)}</span>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('register.countedCash')}</label>
          <input
            className={formStyles.input}
            type="number"
            step="0.01"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
          />
        </div>

        <div className={variance === 0 ? styles.readout : styles.varianceNonZero}>
          <span>{t('register.variance')}</span>
          <span>{variance.toFixed(2)}</span>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('register.notes')}</label>
          <input className={formStyles.input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button type="button" className={formStyles.buttonPrimary} disabled={busy} onClick={handleClose}>
          {t('register.close')}
        </button>
      </div>

      <div className={styles.history}>
        <h2 className={styles.historyTitle}>{t('register.history')}</h2>
        {history.length === 0 ? (
          <p>{t('register.noHistory')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('register.table.date')}</th>
                <th>{t('register.table.openingFloat')}</th>
                <th>{t('register.table.cashSales')}</th>
                <th>{t('register.table.counted')}</th>
                <th>{t('register.table.variance')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((closing) => (
                <tr key={closing.id}>
                  <td>{closing.business_date}</td>
                  <td>{closing.opening_float.toFixed(2)}</td>
                  <td>{closing.cash_sales_total.toFixed(2)}</td>
                  <td>{closing.counted_cash.toFixed(2)}</td>
                  <td className={closing.variance !== 0 ? styles.varianceCell : undefined}>
                    {closing.variance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
