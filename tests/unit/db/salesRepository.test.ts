import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { InsufficientStockError } from '../../../src/main/db/repositories/stockRepository'
import {
  checkoutSale,
  formatInvoiceNo,
  holdSale,
  listHeldSales,
  searchSales
} from '../../../src/main/db/repositories/salesRepository'

async function makeBook(db: Awaited<ReturnType<typeof createTestDb>>['db'], adminId: number, stock: number) {
  return createBook(db, {
    title: 'Test Book',
    costPrice: 100,
    sellingPrice: 200,
    initialStockQty: stock,
    userId: adminId
  })
}

describe('salesRepository', () => {
  it('formatInvoiceNo is sequential and derived from id', () => {
    const date = new Date('2026-03-01T00:00:00Z')
    expect(formatInvoiceNo(1, date)).toBe('INV-2026-000001')
    expect(formatInvoiceNo(42, date)).toBe('INV-2026-000042')
  })

  it('checkoutSale deducts stock and assigns a sequential invoice number', async () => {
    const { db, adminId } = await createTestDb()
    const book = await makeBook(db, adminId, 10)

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 3, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 600 }],
      userId: adminId
    })

    expect(result.sale.status).toBe('completed')
    expect(result.sale.invoice_no).toMatch(/^INV-\d{4}-\d{6}$/)
    expect(result.sale.total).toBe(600)
    expect(result.sale.amount_paid).toBe(600)

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(7)

    await db.destroy()
  })

  it('rolls back the entire sale (no invoice, no stock change) when an item is out of stock', async () => {
    const { db, adminId } = await createTestDb()
    const book = await makeBook(db, adminId, 2)

    await expect(
      checkoutSale(db, {
        items: [{ bookId: book.id, quantity: 5, unitPrice: 200 }],
        payments: [{ method: 'cash', amount: 1000 }],
        userId: adminId
      })
    ).rejects.toBeInstanceOf(InsufficientStockError)

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(2)

    const salesCount = await db
      .selectFrom('sales')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    expect(salesCount.count).toBe(0)

    await db.destroy()
  })

  it('supports split payments across multiple methods', async () => {
    const { db, adminId } = await createTestDb()
    const book = await makeBook(db, adminId, 5)

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }],
      payments: [
        { method: 'cash', amount: 150 },
        { method: 'card', amount: 50 }
      ],
      userId: adminId
    })

    expect(result.payments).toHaveLength(2)
    expect(result.sale.amount_paid).toBe(200)

    await db.destroy()
  })

  it('holds a sale without touching stock, then completing it deducts stock and finalizes the invoice', async () => {
    const { db, adminId } = await createTestDb()
    const book = await makeBook(db, adminId, 5)

    const held = await holdSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 200 }],
      userId: adminId
    })
    expect(held.status).toBe('held')
    expect(held.invoice_no).toMatch(/^HELD-/)

    const stockAfterHold = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterHold.stock_qty).toBe(5)

    expect(await listHeldSales(db)).toHaveLength(1)

    const completed = await checkoutSale(db, {
      heldSaleId: held.id,
      payments: [{ method: 'cash', amount: 400 }],
      userId: adminId
    })

    expect(completed.sale.status).toBe('completed')
    expect(completed.sale.invoice_no).toMatch(/^INV-/)
    expect(await listHeldSales(db)).toHaveLength(0)

    const stockAfterCheckout = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterCheckout.stock_qty).toBe(3)

    await db.destroy()
  })

  it('searchSales finds completed sales by invoice number and excludes held ones', async () => {
    const { db, adminId } = await createTestDb()
    const book = await makeBook(db, adminId, 5)

    await holdSale(db, { items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }], userId: adminId })
    const completed = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })

    const found = await searchSales(db, { invoiceNo: completed.sale.invoice_no })
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe(completed.sale.id)

    const all = await searchSales(db)
    expect(all.every((s) => s.status !== 'held')).toBe(true)

    await db.destroy()
  })
})
