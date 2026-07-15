import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createSupplier } from '../../../src/main/db/repositories/suppliersRepository'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import {
  createPurchaseOrder,
  formatPoNo,
  getPurchaseOrderWithItems,
  listPurchaseOrders,
  updatePurchaseOrderStatus
} from '../../../src/main/db/repositories/purchaseOrdersRepository'

describe('purchaseOrdersRepository', () => {
  it('formatPoNo is derived from id and year', () => {
    expect(formatPoNo(7, new Date('2026-01-01T00:00:00Z'))).toBe('PO-2026-000007')
  })

  it('creates a purchase order with items and assigns a formatted PO number', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier', userId: adminId })
    const book = await createBook(db, {
      title: 'Ordered Book',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })

    const po = await createPurchaseOrder(db, {
      supplierId: supplier.id,
      items: [{ bookId: book.id, quantity: 10, unitCost: 90 }],
      userId: adminId
    })

    expect(po.po_no).toMatch(/^PO-\d{4}-\d{6}$/)
    expect(po.status).toBe('sent')

    const withItems = await getPurchaseOrderWithItems(db, po.id)
    expect(withItems?.items).toHaveLength(1)
    expect(withItems?.items[0].book_title).toBe('Ordered Book')

    expect(await listPurchaseOrders(db, { supplierId: supplier.id })).toHaveLength(1)

    await db.destroy()
  })

  it('updatePurchaseOrderStatus changes status and audits it', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier', userId: adminId })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })
    const po = await createPurchaseOrder(db, {
      supplierId: supplier.id,
      items: [{ bookId: book.id, quantity: 1, unitCost: 90 }],
      userId: adminId
    })

    const cancelled = await updatePurchaseOrderStatus(db, po.id, 'cancelled', adminId)
    expect(cancelled.status).toBe('cancelled')

    await db.destroy()
  })
})
