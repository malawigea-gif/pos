import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface CustomerFormModalProps {
  mode: 'create' | 'edit'
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

export function CustomerFormModal({ mode, customer, onClose, onSaved }: CustomerFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [isCreditAccount, setIsCreditAccount] = useState(Boolean(customer?.is_credit_account))
  const [creditLimit, setCreditLimit] = useState(customer ? String(customer.credit_limit) : '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('customers.form.nameRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        isCreditAccount,
        creditLimit: Number(creditLimit) || 0
      }
      if (mode === 'create') {
        await window.api.customers.create(input)
      } else if (customer) {
        await window.api.customers.update(customer.id, input)
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
      title={mode === 'create' ? t('customers.list.addCustomer') : t('customers.list.editCustomer')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="customer-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('customers.form.name')}</label>
          <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('customers.form.phone')}</label>
            <input className={formStyles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('customers.form.email')}</label>
            <input className={formStyles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('customers.form.address')}</label>
          <input className={formStyles.input} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>
              <input
                type="checkbox"
                checked={isCreditAccount}
                onChange={(e) => setIsCreditAccount(e.target.checked)}
              />{' '}
              {t('customers.form.isCreditAccount')}
            </label>
          </div>
          {isCreditAccount && (
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('customers.form.creditLimit')}</label>
              <input
                className={formStyles.input}
                type="number"
                min="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
