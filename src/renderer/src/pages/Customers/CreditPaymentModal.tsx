import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface CreditPaymentModalProps {
  customer: Customer
  onClose: () => void
  onSaved: () => void
}

export function CreditPaymentModal({ customer, onClose, onSaved }: CreditPaymentModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const [amount, setAmount] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await window.api.customers.recordCreditPayment({ customerId: customer.id, amount: Number(amount) || 0 })
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('customers.creditPayment.title', { name: customer.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="credit-payment-form"
            className={formStyles.buttonPrimary}
            disabled={saving}
          >
            {t('customers.creditPayment.submit')}
          </button>
        </>
      }
    >
      <form id="credit-payment-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}
        <p className={formStyles.hint}>
          {t('customers.creditPayment.currentBalance', { amount: customer.credit_balance.toFixed(2) })}
        </p>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('customers.creditPayment.amount')}</label>
          <input
            className={formStyles.input}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
      </form>
    </Modal>
  )
}
