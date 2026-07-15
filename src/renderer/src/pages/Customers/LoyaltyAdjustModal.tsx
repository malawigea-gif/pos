import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface LoyaltyAdjustModalProps {
  customer: Customer
  onClose: () => void
  onSaved: () => void
}

export function LoyaltyAdjustModal({ customer, onClose, onSaved }: LoyaltyAdjustModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const [pointsChange, setPointsChange] = useState('0')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await window.api.customers.adjustLoyaltyPoints({
        customerId: customer.id,
        pointsChange: Number(pointsChange) || 0,
        reason: reason.trim() || 'Manual adjustment'
      })
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('customers.loyalty.title', { name: customer.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="loyalty-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('customers.loyalty.submit')}
          </button>
        </>
      }
    >
      <form id="loyalty-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}
        <p className={formStyles.hint}>
          {t('customers.loyalty.currentPoints', { points: customer.loyalty_points })}
        </p>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('customers.loyalty.pointsChange')}</label>
          <input
            className={formStyles.input}
            type="number"
            value={pointsChange}
            onChange={(e) => setPointsChange(e.target.value)}
            autoFocus
          />
          <p className={formStyles.hint}>{t('customers.loyalty.pointsChangeHint')}</p>
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('customers.loyalty.reason')}</label>
          <input className={formStyles.input} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}
