import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaxRate } from '@shared/pricing'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface TaxRateFormModalProps {
  mode: 'create' | 'edit'
  taxRate?: TaxRate
  onClose: () => void
  onSaved: () => void
}

export function TaxRateFormModal({ mode, taxRate, onClose, onSaved }: TaxRateFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [name, setName] = useState(taxRate?.name ?? '')
  const [ratePercent, setRatePercent] = useState(taxRate ? String(taxRate.rate_percent) : '0')
  const [isExempt, setIsExempt] = useState(Boolean(taxRate?.is_exempt))
  const [isDefault, setIsDefault] = useState(Boolean(taxRate?.is_default))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim(),
        ratePercent: isExempt ? 0 : Number(ratePercent) || 0,
        isExempt,
        isDefault
      }
      if (mode === 'create') {
        await window.api.pricing.createTaxRate(input)
      } else if (taxRate) {
        await window.api.pricing.updateTaxRate(taxRate.id, input)
      }
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? t('pricing.taxRates.add') : t('pricing.taxRates.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="tax-rate-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="tax-rate-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('pricing.taxRates.name')}</label>
          <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>
            <input type="checkbox" checked={isExempt} onChange={(e) => setIsExempt(e.target.checked)} />{' '}
            {t('pricing.taxRates.isExempt')}
          </label>
        </div>

        {!isExempt && (
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.taxRates.ratePercent')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="0"
              step="0.01"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
            />
          </div>
        )}

        <div className={formStyles.field}>
          <label className={formStyles.label}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />{' '}
            {t('pricing.taxRates.isDefault')}
          </label>
        </div>
      </form>
    </Modal>
  )
}
