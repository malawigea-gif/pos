import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Supplier } from '@shared/suppliers'
import type { Grn, PurchaseOrder } from '@shared/purchasing'
import { useDescribeError } from '../../lib/ipcError'
import { LineItemsEditor, type LineItem } from './LineItemsEditor'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function GoodsReceivedTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [grns, setGrns] = useState<Grn[]>([])
  const [openPos, setOpenPos] = useState<PurchaseOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)

  async function loadAll(): Promise<void> {
    try {
      const [supplierList, grnList] = await Promise.all([
        window.api.suppliers.list(),
        window.api.purchasing.listGrns()
      ])
      setSuppliers(supplierList)
      setGrns(grnList)
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPurchaseOrderId('')
    if (!supplierId) {
      setOpenPos([])
      return
    }
    window.api.purchasing
      .listPurchaseOrders({ supplierId: Number(supplierId), status: 'sent' })
      .then(setOpenPos)
  }, [supplierId])

  async function handleSelectPo(id: string): Promise<void> {
    setPurchaseOrderId(id)
    if (!id) return
    const result = await window.api.purchasing.getPurchaseOrderWithItems(Number(id))
    if (!result) return
    setLines(
      result.items.map((item) => ({
        bookId: item.book_id,
        title: item.book_title,
        quantity: item.quantity,
        unitCost: item.unit_cost
      }))
    )
  }

  function supplierName(id: number): string {
    return suppliers.find((s) => s.id === id)?.name ?? '—'
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!supplierId || lines.length === 0) return

    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)
      await window.api.purchasing.createGrn({
        supplierId: Number(supplierId),
        purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : undefined,
        items: lines.map((l) => ({ bookId: l.bookId, quantity: l.quantity, unitCost: l.unitCost })),
        notes: notes.trim() || undefined
      })
      setStatus(t('suppliers.goodsReceived.receivedSummary', { amount: total.toFixed(2) }))
      setSupplierId('')
      setPurchaseOrderId('')
      setNotes('')
      setLines([])
      await loadAll()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      {status && <div className={formStyles.error} style={{ background: '#e8f5e9', color: '#2e7d32' }}>{status}</div>}

      <form onSubmit={handleCreate}>
        <h3>{t('suppliers.goodsReceived.create')}</h3>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('suppliers.goodsReceived.supplier')}</label>
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
            <label className={formStyles.label}>{t('suppliers.goodsReceived.linkedPo')}</label>
            <select
              className={formStyles.select}
              value={purchaseOrderId}
              onChange={(e) => handleSelectPo(e.target.value)}
              disabled={!supplierId}
            >
              <option value="">{t('suppliers.goodsReceived.noPo')}</option>
              {openPos.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_no}
                </option>
              ))}
            </select>
          </div>
        </div>

        <LineItemsEditor lines={lines} onChange={setLines} />

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('suppliers.goodsReceived.notes')}</label>
          <input className={formStyles.input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button
          type="submit"
          className={formStyles.buttonPrimary}
          disabled={saving || !supplierId || lines.length === 0}
        >
          {t('suppliers.goodsReceived.create')}
        </button>
      </form>

      <hr />

      {grns.length === 0 ? (
        <p>{t('suppliers.goodsReceived.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('suppliers.goodsReceived.table.grnNo')}</th>
              <th>{t('suppliers.goodsReceived.table.supplier')}</th>
              <th>{t('suppliers.goodsReceived.table.receivedDate')}</th>
              <th>{t('suppliers.goodsReceived.table.total')}</th>
            </tr>
          </thead>
          <tbody>
            {grns.map((grn) => (
              <tr key={grn.id}>
                <td>{grn.grn_no}</td>
                <td>{supplierName(grn.supplier_id)}</td>
                <td>{new Date(grn.received_date).toLocaleDateString()}</td>
                <td>{grn.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
