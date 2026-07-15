import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Supplier } from '@shared/suppliers'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface SupplierFormModalProps {
  mode: 'create' | 'edit'
  supplier?: Supplier
  onClose: () => void
  onSaved: () => void
}

export function SupplierFormModal({ mode, supplier, onClose, onSaved }: SupplierFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [name, setName] = useState(supplier?.name ?? '')
  const [contactPerson, setContactPerson] = useState(supplier?.contact_person ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('suppliers.form.nameRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null
      }
      if (mode === 'create') {
        await window.api.suppliers.create(input)
      } else if (supplier) {
        await window.api.suppliers.update(supplier.id, input)
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
      title={mode === 'create' ? t('suppliers.list.addSupplier') : t('suppliers.list.editSupplier')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="supplier-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('suppliers.form.name')}</label>
          <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('suppliers.form.contactPerson')}</label>
          <input
            className={formStyles.input}
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.form.phone')}</label>
            <input className={formStyles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.form.email')}</label>
            <input className={formStyles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('suppliers.form.address')}</label>
          <input className={formStyles.input} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}
