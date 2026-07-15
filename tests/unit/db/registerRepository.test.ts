import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { checkoutSale } from '../../../src/main/db/repositories/salesRepository'
import { computeCashSummary, createRegisterClosing } from '../../../src/main/db/repositories/registerRepository'

describe('registerRepository', () => {
  it('sums cash and non-cash sales separately for a business date', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Register Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })
    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'card', amount: 200 }],
      userId: adminId
    })

    const today = new Date().toISOString().slice(0, 10)
    const summary = await computeCashSummary(db, today)
    expect(summary.cashSalesTotal).toBe(200)
    expect(summary.nonCashSalesTotal).toBe(200)

    await db.destroy()
  })

  it('computes a positive variance when counted cash exceeds expected', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Register Book 2',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })
    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })

    const today = new Date().toISOString().slice(0, 10)
    const closing = await createRegisterClosing(db, {
      businessDate: today,
      openingFloat: 1000,
      countedCash: 1250,
      userId: adminId
    })

    // expected = openingFloat(1000) + cashSales(200) = 1200; counted 1250 => +50
    expect(closing.cash_sales_total).toBe(200)
    expect(closing.variance).toBe(50)

    await db.destroy()
  })
})
