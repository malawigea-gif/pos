import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PaymentMethod } from '@shared/sales'
import type { ReturnableSaleInfo } from '@shared/returns'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

const REFUND_METHODS: PaymentMethod[] = ['cash', 'card', 'mobile_wallet', 'other']

export function ProcessReturnTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [invoiceNo, setInvoiceNo] = useState('')
  const [info, setInfo] = useState<ReturnableSaleInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [threshold, setThreshold] = useState(0)

  useEffect(() => {
    window.api.returns.getApprovalThreshold().then(setThreshold)
  }, [])

  async function handleSearch(): Promise<void> {
    const term = invoiceNo.trim()
    if (!term) return

    setSearching(true)
    setError(null)
    setStatus(null)
    setNotFound(false)
    setInfo(null)
    try {
      const matches = await window.api.sales.search({ invoiceNo: term })
      const exact = matches.find((s) => s.invoice_no === term)
      if (!exact) {
        setNotFound(true)
        return
      }
      const result = await window.api.returns.getReturnableSaleItems(exact.id)
      if (!result) {
        setNotFound(true)
        return
      }
      setInfo(result)
      setReturnQtys(Object.fromEntries(result.items.map((i) => [i.saleItemId, '0'])))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSearching(false)
    }
  }

  function refundAmountFor(saleItemId: number, unitRefund: number): number {
    const qty = Number(returnQtys[saleItemId] ?? '0') || 0
    return qty * unitRefund
  }

  const totalRefund = info
    ? info.items.reduce((sum, item) => sum + refundAmountFor(item.saleItemId, item.unitRefundAmount), 0)
    : 0

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!info) return

    const items = info.items
      .map((item) => ({ saleItemId: item.saleItemId, quantity: Number(returnQtys[item.saleItemId] ?? '0') || 0 }))
      .filter((item) => item.quantity > 0)
    if (items.length === 0) return

    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const created = await window.api.returns.create({
        saleId: info.sale.id,
        items,
        reason: reason.trim() || undefined,
        refundMethod
      })
      setStatus(
        created.status === 'pending_approval'
          ? t('returns.process.pendingSummary', { returnNo: created.return_no })
          : t('returns.process.completedSummary', {
              returnNo: created.return_no,
              amount: formatCurrency(created.refund_total, lang)
            })
      )
      setInfo(null)
      setInvoiceNo('')
      setReason('')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      {status && <div className={styles.statusNotice}>{status}</div>}

      <div className={styles.toolbar}>
        <input
          className={formStyles.input}
          placeholder={t('returns.process.searchPlaceholder')}
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button type="button" className={formStyles.buttonPrimary} onClick={handleSearch} disabled={searching}>
          {t('returns.process.search')}
        </button>
      </div>

      {notFound && <p>{t('returns.process.notFound')}</p>}

      {info && (
        <form onSubmit={handleSubmit}>
          <h3>{t('returns.process.invoiceLabel', { invoiceNo: info.sale.invoice_no })}</h3>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('returns.process.table.item')}</th>
                <th>{t('returns.process.table.purchasedQty')}</th>
                <th>{t('returns.process.table.alreadyReturned')}</th>
                <th>{t('returns.process.table.returnQty')}</th>
                <th>{t('returns.process.table.refundAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {info.items.map((item) => (
                <tr key={item.saleItemId}>
                  <td>{item.bookTitle}</td>
                  <td>{item.quantity}</td>
                  <td>{item.alreadyClaimed}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={item.returnable}
                      className={formStyles.input}
                      style={{ width: 80 }}
                      value={returnQtys[item.saleItemId] ?? '0'}
                      disabled={item.returnable === 0}
                      onChange={(e) =>
                        setReturnQtys((prev) => ({ ...prev, [item.saleItemId]: e.target.value }))
                      }
                    />
                  </td>
                  <td>{formatCurrency(refundAmountFor(item.saleItemId, item.unitRefundAmount), lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={formStyles.row}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('returns.process.reason')}</label>
              <input className={formStyles.input} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('returns.process.refundMethod')}</label>
              <select
                className={formStyles.select}
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
              >
                {REFUND_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`sales.payment.methods.${method}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className={formStyles.hint}>{t('sales.cart.total')}: {formatCurrency(totalRefund, lang)}</p>

          {totalRefund > threshold && (
            <p className={formStyles.hint}>
              {t('returns.process.needsApproval', {
                amount: formatCurrency(totalRefund, lang),
                threshold: formatCurrency(threshold, lang)
              })}
            </p>
          )}

          <button type="submit" className={formStyles.buttonPrimary} disabled={saving || totalRefund <= 0}>
            {t('returns.process.submit')}
          </button>
        </form>
      )}
    </div>
  )
}
