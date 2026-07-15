import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Return } from '@shared/returns'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function PendingApprovalsTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [pending, setPending] = useState<Return[]>([])
  const [invoiceBySaleId, setInvoiceBySaleId] = useState<Record<number, string>>({})
  const [threshold, setThreshold] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function load(): Promise<void> {
    try {
      const [returns, currentThreshold] = await Promise.all([
        window.api.returns.listPendingApprovals(),
        window.api.returns.getApprovalThreshold()
      ])
      setPending(returns)
      setThreshold(String(currentThreshold))

      const sales = await Promise.all(returns.map((r) => window.api.sales.getWithItems(r.sale_id)))
      const map: Record<number, string> = {}
      sales.forEach((s, index) => {
        if (s) map[returns[index].sale_id] = s.sale.invoice_no
      })
      setInvoiceBySaleId(map)
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApprove(returnId: number): Promise<void> {
    if (!window.confirm(t('returns.pending.confirmApprove'))) return
    try {
      await window.api.returns.approve(returnId)
      await load()
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleReject(returnId: number): Promise<void> {
    if (!window.confirm(t('returns.pending.confirmReject'))) return
    try {
      await window.api.returns.reject(returnId)
      await load()
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleSaveThreshold(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    try {
      await window.api.returns.setApprovalThreshold(Number(threshold) || 0)
      setStatus(t('returns.pending.thresholdSaved'))
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      {status && <div className={styles.statusNotice}>{status}</div>}

      <form onSubmit={handleSaveThreshold} className={formStyles.row}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('returns.pending.thresholdLabel')}</label>
          <input
            className={formStyles.input}
            type="number"
            min="0"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <p className={formStyles.hint}>{t('returns.pending.thresholdHint')}</p>
        </div>
        <button type="submit" className={formStyles.buttonSecondary}>
          {t('returns.pending.thresholdSave')}
        </button>
      </form>

      <hr />

      {pending.length === 0 ? (
        <p>{t('returns.pending.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('returns.pending.table.returnNo')}</th>
              <th>{t('returns.pending.table.invoice')}</th>
              <th>{t('returns.pending.table.refundTotal')}</th>
              <th>{t('returns.pending.table.reason')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((ret) => (
              <tr key={ret.id}>
                <td>{ret.return_no}</td>
                <td>{invoiceBySaleId[ret.sale_id] ?? ret.sale_id}</td>
                <td>{formatCurrency(ret.refund_total, lang)}</td>
                <td>{ret.reason}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => handleApprove(ret.id)}>
                    {t('returns.pending.approve')}
                  </button>
                  <button type="button" onClick={() => handleReject(ret.id)}>
                    {t('returns.pending.reject')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
