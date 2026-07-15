import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createSupplier } from '../../../src/main/db/repositories/suppliersRepository'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createPurchaseOrder } from '../../../src/main/db/repositories/purchaseOrdersRepository'
import { createGrn, formatGrnNo, getGrnWithItems } from '../../../src/main/db/repositories/grnRepository'

describe('grnRepository', () => {
  it('formatGrnNo is derived from id and year', () => {
    expect(formatGrnNo(3, new Date('2026-05-01T00:00:00Z'))).toBe('GRN-2026-000003')
  })

  it('receiving goods increases stock and the supplier balance atomically', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier', userId: adminId })
    const book = await createBook(db, {
      title: 'Restocked Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: adminId
    })

    const grn = await createGrn(db, {
      supplierId: supplier.id,
      items: [{ bookId: book.id, quantity: 20, unitCost: 95 }],
      userId: adminId
    })

    expect(grn.grn_no).toMatch(/^GRN-\d{4}-\d{6}$/)
    expect(grn.total).toBe(1900)

    const stockRow = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockRow.stock_qty).toBe(25)

    const supplierRow = await db
      .selectFrom('suppliers')
      .select('balance')
      .where('id', '=', supplier.id)
      .executeTakeFirstOrThrow()
    expect(supplierRow.balance).toBe(1900)

    const movements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('book_id', '=', book.id)
      .where('movement_type', '=', 'grn')
      .execute()
    expect(movements).toHaveLength(1)
    expect(movements[0].change_qty).toBe(20)

    const withItems = await getGrnWithItems(db, grn.id)
    expect(withItems?.items).toHaveLength(1)

    await db.destroy()
  })

  it('marks a linked purchase order as received', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier', userId: adminId })
    const book = await createBook(db, {
      title: 'PO Book',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })
    const po = await createPurchaseOrder(db, {
      supplierId: supplier.id,
      items: [{ bookId: book.id, quantity: 10, unitCost: 90 }],
      userId: adminId
    })
    expect(po.status).toBe('sent')

    await createGrn(db, {
      supplierId: supplier.id,
      purchaseOrderId: po.id,
      items: [{ bookId: book.id, quantity: 10, unitCost: 90 }],
      userId: adminId
    })

    const updatedPo = await db
      .selectFrom('purchase_orders')
      .selectAll()
      .where('id', '=', po.id)
      .executeTakeFirstOrThrow()
    expect(updatedPo.status).toBe('received')

    await db.destroy()
  })
})
