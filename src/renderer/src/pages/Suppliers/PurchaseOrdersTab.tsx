import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Supplier } from '@shared/suppliers'
import type { PurchaseOrder } from '@shared/purchasing'
import { useDescribeError } from '../../lib/ipcError'
import { LineItemsEditor, type LineItem } from './LineItemsEditor'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function PurchaseOrdersTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [error, setError] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)

  async function loadAll(): Promise<void> {
    try {
      const [supplierList, orderList] = await Promise.all([
        window.api.suppliers.list(),
        window.api.purchasing.listPurchaseOrders()
      ])
      setSuppliers(supplierList)
      setOrders(orderList)
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
    if (!supplierId || lines.length === 0) return

    setSaving(true)
    setError(null)
    try {
      await window.api.purchasing.createPurchaseOrder({
        supplierId: Number(supplierId),
        items: lines.map((l) => ({ bookId: l.bookId, quantity: l.quantity, unitCost: l.unitCost })),
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined
      })
      setSupplierId('')
      setExpectedDate('')
      setNotes('')
      setLines([])
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: number): Promise<void> {
    try {
      await window.api.purchasing.updatePurchaseOrderStatus(id, 'cancelled')
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}

      <form onSubmit={handleCreate}>
        <h3>{t('suppliers.purchaseOrders.create')}</h3>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.purchaseOrders.supplier')}</label>
            <select
              className={formStyles.select}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.purchaseOrders.expectedDate')}</label>
            <input
              className={formStyles.input}
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        <LineItemsEditor lines={lines} onChange={setLines} />

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('suppliers.purchaseOrders.notes')}</label>
          <input className={formStyles.input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button
          type="submit"
          className={formStyles.buttonPrimary}
          disabled={saving || !supplierId || lines.length === 0}
        >
          {t('suppliers.purchaseOrders.create')}
        </button>
      </form>

      <hr />

      {orders.length === 0 ? (
        <p>{t('suppliers.purchaseOrders.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('suppliers.purchaseOrders.table.poNo')}</th>
              <th>{t('suppliers.purchaseOrders.table.supplier')}</th>
              <th>{t('suppliers.purchaseOrders.table.status')}</th>
              <th>{t('suppliers.purchaseOrders.table.orderDate')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.po_no}</td>
                <td>{supplierName(order.supplier_id)}</td>
                <td>{t(`suppliers.purchaseOrders.status.${order.status}`)}</td>
                <td>{new Date(order.order_date).toLocaleDateString()}</td>
                <td className={styles.actionsCell}>
                  {(order.status === 'draft' || order.status === 'sent') && (
                    <button type="button" onClick={() => handleCancel(order.id)}>
                      {t('suppliers.purchaseOrders.cancel')}
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
