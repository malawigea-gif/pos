import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Supplier, SupplierPayment } from '@shared/suppliers'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function SupplierPaymentsTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [error, setError] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [amount, setAmount] = useState('0')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paidImmediately, setPaidImmediately] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadAll(): Promise<void> {
    try {
      const [supplierList, paymentList] = await Promise.all([
        window.api.suppliers.list(),
        window.api.suppliers.listPayments()
      ])
      setSuppliers(supplierList)
      setPayments(paymentList)
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function supplierName(id: number): string {
    return suppliers.find((s) => s.id === id)?.name ?? '—'
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!supplierId) return

    setSaving(true)
    setError(null)
    try {
      await window.api.suppliers.createPayment({
        supplierId: Number(supplierId),
        amount: Number(amount) || 0,
        method: method || undefined,
        reference: reference.trim() || undefined,
        dueDate: dueDate || undefined,
        paidImmediately
      })
      setSupplierId('')
      setAmount('0')
      setReference('')
      setDueDate('')
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkPaid(id: number): Promise<void> {
    try {
      await window.api.suppliers.markPaymentPaid(id)
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}

      <form onSubmit={handleCreate}>
        <h3>{t('suppliers.payments.create')}</h3>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.payments.supplier')}</label>
            <select
              className={formStyles.select}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.payments.amount')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.payments.method')}</label>
            <input className={formStyles.input} value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.payments.reference')}</label>
            <input
              className={formStyles.input}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.payments.dueDate')}</label>
            <input
              className={formStyles.input}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>
              <input
                type="checkbox"
                checked={paidImmediately}
                onChange={(e) => setPaidImmediately(e.target.checked)}
              />{' '}
              {t('suppliers.payments.paidImmediately')}
            </label>
          </div>
        </div>

        <button type="submit" className={formStyles.buttonPrimary} disabled={saving || !supplierId}>
          {t('suppliers.payments.create')}
        </button>
      </form>

      <hr />

      {payments.length === 0 ? (
        <p>{t('suppliers.payments.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('suppliers.payments.table.supplier')}</th>
              <th>{t('suppliers.payments.table.amount')}</th>
              <th>{t('suppliers.payments.table.dueDate')}</th>
              <th>{t('suppliers.payments.table.paidDate')}</th>
              <th>{t('suppliers.payments.table.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{supplierName(payment.supplier_id)}</td>
                <td>{payment.amount.toFixed(2)}</td>
                <td>{payment.due_date ?? '—'}</td>
                <td>{payment.paid_date ? new Date(payment.paid_date).toLocaleDateString() : '—'}</td>
                <td>{payment.paid_date ? t('suppliers.payments.paid') : t('suppliers.payments.unpaid')}</td>
                <td className={styles.actionsCell}>
                  {!payment.paid_date && (
                    <button type="button" onClick={() => handleMarkPaid(payment.id)}>
                      {t('suppliers.payments.markPaid')}
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
