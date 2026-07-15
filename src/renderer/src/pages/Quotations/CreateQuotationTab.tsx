import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import { useDescribeError } from '../../lib/ipcError'
import { ItemSearchCart } from '../../components/ItemSearchCart/ItemSearchCart'
import { CustomerSelect } from '../../components/CustomerSelect/CustomerSelect'
import type { CartLine } from '../Sales/types'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './QuotationsPage.module.css'

interface CreateQuotationTabProps {
  onSaved: () => void
}

export function CreateQuotationTab({ onSaved }: CreateQuotationTabProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      await window.api.quotations.create({
        items: cart.map((line) => ({ bookId: line.bookId, quantity: line.quantity, unitPrice: line.unitPrice })),
        customerId: selectedCustomer?.id,
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined
      })
      setCart([])
      setSelectedCustomer(null)
      setValidUntil('')
      setNotes('')
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {error && <div className={formStyles.error}>{error}</div>}
        <ItemSearchCart cart={cart} setCart={setCart} />
      </div>

      <div className={styles.summary}>
        <CustomerSelect customer={selectedCustomer} onChange={setSelectedCustomer} />

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('quotations.form.validUntil')}</label>
          <input
            className={formStyles.input}
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('quotations.form.notes')}</label>
          <input className={formStyles.input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className={styles.totalRow}>
          <span>{t('sales.cart.total')}</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>

        <button
          type="button"
          className={formStyles.buttonPrimary}
          disabled={cart.length === 0 || saving}
          onClick={handleSave}
        >
          {t('quotations.form.saveQuotation')}
        </button>
      </div>
    </div>
  )
}
