import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CartItemInput, PaymentInput, PaymentMethod, ReceiptData } from '@shared/sales'
import type { ReceiptLanguage } from '@shared/receiptLabels'
import type { Customer } from '@shared/customers'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './PaymentModal.module.css'

const BASE_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'mobile_wallet', 'other']

interface PaymentRow {
  method: PaymentMethod
  amount: string
}

interface PaymentModalProps {
  total: number
  heldSaleId?: number
  items?: CartItemInput[]
  customer: Customer | null
  uiLanguage: ReceiptLanguage
  onClose: () => void
  onComplete: (data: ReceiptData) => void
}

export function PaymentModal({
  total,
  heldSaleId,
  items,
  customer,
  uiLanguage,
  onClose,
  onComplete
}: PaymentModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const [rows, setRows] = useState<PaymentRow[]>([{ method: 'cash', amount: total.toFixed(2) }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canUseCredit = Boolean(customer?.is_credit_account)
  const availableCredit = customer ? customer.credit_limit - customer.credit_balance : 0
  const paymentMethods = canUseCredit ? [...BASE_PAYMENT_METHODS, 'credit' as const] : BASE_PAYMENT_METHODS

  const totalPaid = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const remaining = Math.max(0, total - totalPaid)
  const changeDue = Math.max(0, totalPaid - total)

  function updateRow(index: number, patch: Partial<PaymentRow>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow(): void {
    setRows((prev) => [...prev, { method: 'cash', amount: remaining > 0 ? remaining.toFixed(2) : '0' }])
  }

  function removeRow(index: number): void {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true)
    setError(null)
    try {
      const payments: PaymentInput[] = rows
        .filter((row) => Number(row.amount) > 0)
        .map((row) => ({ method: row.method, amount: Number(row.amount) }))

      const data = await window.api.sales.checkout({
        heldSaleId,
        items,
        payments,
        customerId: customer?.id,
        uiLanguage
      })
      onComplete(data)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('sales.payment.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={formStyles.buttonPrimary}
            disabled={submitting || remaining > 0}
            onClick={handleConfirm}
          >
            {t('sales.payment.confirm')}
          </button>
        </>
      }
    >
      {error && <div className={formStyles.error}>{error}</div>}

      <div className={styles.totalDue}>
        <span>{t('sales.payment.totalDue')}</span>
        <span>{total.toFixed(2)}</span>
      </div>

      {canUseCredit && (
        <p className={formStyles.hint}>
          {t('sales.payment.availableCredit', { amount: availableCredit.toFixed(2) })}
        </p>
      )}

      {rows.map((row, index) => (
        <div key={index} className={styles.row}>
          <select
            className={formStyles.select}
            value={row.method}
            onChange={(e) => updateRow(index, { method: e.target.value as PaymentMethod })}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {t(`sales.payment.methods.${method}`)}
              </option>
            ))}
          </select>
          <input
            className={formStyles.input}
            type="number"
            min="0"
            step="0.01"
            value={row.amount}
            onChange={(e) => updateRow(index, { amount: e.target.value })}
          />
          {rows.length > 1 && (
            <button type="button" onClick={() => removeRow(index)}>
              {t('sales.payment.remove')}
            </button>
          )}
        </div>
      ))}

      <button type="button" className={formStyles.buttonSecondary} onClick={addRow}>
        {t('sales.payment.addPayment')}
      </button>

      <div className={styles.summary}>
        <div>
          <span>{t('sales.payment.totalPaid')}</span>
          <span>{totalPaid.toFixed(2)}</span>
        </div>
        {remaining > 0 ? (
          <div className={styles.remaining}>
            <span>{t('sales.payment.remaining')}</span>
            <span>{remaining.toFixed(2)}</span>
          </div>
        ) : (
          changeDue > 0 && (
            <div>
              <span>{t('sales.payment.changeDue')}</span>
              <span>{changeDue.toFixed(2)}</span>
            </div>
          )
        )}
      </div>
    </Modal>
  )
}
