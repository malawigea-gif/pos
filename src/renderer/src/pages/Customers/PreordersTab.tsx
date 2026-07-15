import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import type { PreorderStatus, PreorderView } from '@shared/preorders'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

const NEXT_STATUS: Partial<Record<PreorderStatus, PreorderStatus>> = {
  pending: 'notified',
  notified: 'fulfilled'
}

export function PreordersTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [preorders, setPreorders] = useState<PreorderView[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isbn, setIsbn] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadAll(): Promise<void> {
    try {
      const [preorderList, customerList] = await Promise.all([
        window.api.preorders.list(),
        window.api.customers.list()
      ])
      setPreorders(preorderList)
      setCustomers(customerList)
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!customerId || !title.trim()) return

    setSaving(true)
    setError(null)
    try {
      await window.api.preorders.create({
        customerId: Number(customerId),
        title: title.trim(),
        isbn: isbn.trim() || undefined,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || undefined
      })
      setTitle('')
      setIsbn('')
      setQuantity('1')
      setNotes('')
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: number, status: PreorderStatus): Promise<void> {
    try {
      await window.api.preorders.updateStatus(id, status)
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}

      <form onSubmit={handleCreate} className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
        <select
          className={formStyles.select}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">{t('customers.preorders.customer')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className={formStyles.input}
          placeholder={t('customers.preorders.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={formStyles.input}
          placeholder={t('customers.preorders.isbn')}
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
        />
        <input
          className={formStyles.input}
          type="number"
          min="1"
          style={{ width: 80 }}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button type="submit" className={formStyles.buttonPrimary} disabled={saving}>
          {t('customers.preorders.create')}
        </button>
      </form>

      {preorders.length === 0 ? (
        <p>{t('customers.preorders.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('customers.preorders.table.customer')}</th>
              <th>{t('customers.preorders.table.title')}</th>
              <th>{t('customers.preorders.table.quantity')}</th>
              <th>{t('customers.preorders.table.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {preorders.map((preorder) => (
              <tr key={preorder.id}>
                <td>{preorder.customer_name}</td>
                <td>{preorder.title}</td>
                <td>{preorder.quantity}</td>
                <td>{t(`customers.preorders.status.${preorder.status}`)}</td>
                <td className={styles.actionsCell}>
                  {NEXT_STATUS[preorder.status] && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(preorder.id, NEXT_STATUS[preorder.status]!)}
                    >
                      {preorder.status === 'pending'
                        ? t('customers.preorders.markNotified')
                        : t('customers.preorders.markFulfilled')}
                    </button>
                  )}
                  {(preorder.status === 'pending' || preorder.status === 'notified') && (
                    <button type="button" onClick={() => handleStatusChange(preorder.id, 'cancelled')}>
                      {t('customers.preorders.cancel')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
