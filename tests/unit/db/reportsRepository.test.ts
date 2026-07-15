import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import { createSupplier } from '../../../src/main/db/repositories/suppliersRepository'
import { createGrn } from '../../../src/main/db/repositories/grnRepository'
import { checkoutSale } from '../../../src/main/db/repositories/salesRepository'
import {
  getBestSellers,
  getProfitAndLoss,
  getSalesByAuthor,
  getSalesByCashier,
  getSalesByCategory,
  getSalesBySupplier,
  getSalesSummary,
  getSlowMovers
} from '../../../src/main/db/repositories/reportsRepository'

const FULL_RANGE = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' }

async function setSaleDate(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
  saleId: number,
  isoDate: string
) {
  await db.updateTable('sales').set({ sale_date: isoDate }).where('id', '=', saleId).execute()
}

describe('reportsRepository', () => {
  it('getSalesSummary buckets sales by day, week, and month', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 500,
      initialStockQty: 10,
      userId: adminId
    })

    const saleA = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 500 }],
      userId: adminId
    })
    await setSaleDate(db, saleA.sale.id, '2026-01-06T10:00:00.000Z') // a Tuesday

    const saleB = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 500 }],
      userId: adminId
    })
    await setSaleDate(db, saleB.sale.id, '2026-01-08T10:00:00.000Z') // same ISO week, different day

    const saleC = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 500 }],
      userId: adminId
    })
    await setSaleDate(db, saleC.sale.id, '2026-02-15T10:00:00.000Z') // different month

    const byDay = await getSalesSummary(db, FULL_RANGE, 'day')
    expect(byDay).toHaveLength(3)
    expect(byDay.map((r) => r.period)).toEqual(['2026-01-06', '2026-01-08', '2026-02-15'])

    const byWeek = await getSalesSummary(db, FULL_RANGE, 'week')
    expect(byWeek).toHaveLength(2) // Jan 6 & 8 share a week, Feb 15 is a different week
    expect(byWeek.find((r) => r.period === '2026-W02')?.salesCount).toBe(2)

    const byMonth = await getSalesSummary(db, FULL_RANGE, 'month')
    expect(byMonth).toHaveLength(2)
    expect(byMonth.find((r) => r.period === '2026-01')?.itemsSold).toBe(2)
    expect(byMonth.find((r) => r.period === '2026-02')?.itemsSold).toBe(1)

    await db.destroy()
  })

  it('getBestSellers and getSlowMovers rank books by quantity sold', async () => {
    const { db, adminId } = await createTestDb()
    const popular = await createBook(db, {
      title: 'Popular Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 20,
      userId: adminId
    })
    const unpopular = await createBook(db, {
      title: 'Unpopular Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 20,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: popular.id, quantity: 10, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 2000 }],
      userId: adminId
    })
    await checkoutSale(db, {
      items: [{ bookId: unpopular.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })

    const bestSellers = await getBestSellers(db, FULL_RANGE, 10)
    expect(bestSellers[0].bookId).toBe(popular.id)
    expect(bestSellers[0].quantitySold).toBe(10)

    const slowMovers = await getSlowMovers(db, FULL_RANGE, 10)
    expect(slowMovers[0].bookId).toBe(unpopular.id)
    expect(slowMovers[0].quantitySold).toBe(1)

    await db.destroy()
  })

  it('getProfitAndLoss computes revenue net of tax minus cost of goods sold', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 5, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 1500 }],
      userId: adminId
    })

    const pl = await getProfitAndLoss(db, FULL_RANGE)
    expect(pl.revenue).toBe(1500)
    expect(pl.cogs).toBe(500) // 5 * 100
    expect(pl.grossProfit).toBe(1000)

    await db.destroy()
  })

  it('getSalesByCategory groups uncategorized books under a null label', async () => {
    const { db, adminId } = await createTestDb()
    const category = await createCategory(db, { name: 'Fiction', userId: adminId })
    const categorized = await createBook(db, {
      title: 'Categorized',
      costPrice: 100,
      sellingPrice: 200,
      categoryId: category.id,
      initialStockQty: 10,
      userId: adminId
    })
    const uncategorized = await createBook(db, {
      title: 'Uncategorized',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: categorized.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })
    await checkoutSale(db, {
      items: [{ bookId: uncategorized.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 200 }],
      userId: adminId
    })

    const byCategory = await getSalesByCategory(db, FULL_RANGE)
    expect(byCategory.find((r) => r.label === 'Fiction')?.quantitySold).toBe(1)
    expect(byCategory.find((r) => r.key === 'uncategorized')?.label).toBeNull()

    await db.destroy()
  })

  it('getSalesByAuthor and getSalesByCashier aggregate correctly', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      author: 'Martin Wickramasinghe',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 200 }],
      payments: [{ method: 'cash', amount: 400 }],
      userId: adminId
    })

    const byAuthor = await getSalesByAuthor(db, FULL_RANGE)
    expect(byAuthor[0].label).toBe('Martin Wickramasinghe')
    expect(byAuthor[0].quantitySold).toBe(2)

    const byCashier = await getSalesByCashier(db, FULL_RANGE)
    expect(byCashier[0].label).toBe('Administrator')
    expect(byCashier[0].quantitySold).toBe(2)

    await db.destroy()
  })

  it('getSalesBySupplier attributes sales to the most recently receiving supplier', async () => {
    const { db, adminId } = await createTestDb()
    const supplierA = await createSupplier(db, { name: 'Supplier A', userId: adminId })
    const supplierB = await createSupplier(db, { name: 'Supplier B', userId: adminId })
    const book = await createBook(db, {
      title: 'Restocked Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: adminId
    })
    const neverReceived = await createBook(db, {
      title: 'Direct Stock Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: adminId
    })

    const grn1 = await createGrn(db, {
      supplierId: supplierA.id,
      items: [{ bookId: book.id, quantity: 5, unitCost: 90 }],
      userId: adminId
    })
    await db
      .updateTable('goods_received_notes')
      .set({ received_date: '2026-01-01T00:00:00.000Z' })
      .where('id', '=', grn1.id)
      .execute()

    const grn2 = await createGrn(db, {
      supplierId: supplierB.id,
      items: [{ bookId: book.id, quantity: 5, unitCost: 95 }],
      userId: adminId
    })
    await db
      .updateTable('goods_received_notes')
      .set({ received_date: '2026-02-01T00:00:00.000Z' })
      .where('id', '=', grn2.id)
      .execute()

    await checkoutSale(db, {
      items: [
        { bookId: book.id, quantity: 1, unitPrice: 200 },
        { bookId: neverReceived.id, quantity: 1, unitPrice: 200 }
      ],
      payments: [{ method: 'cash', amount: 400 }],
      userId: adminId
    })

    const bySupplier = await getSalesBySupplier(db, FULL_RANGE)
    // book's most recent GRN was from Supplier B (2026-02), not Supplier A
    expect(bySupplier.find((r) => r.label === 'Supplier B')?.quantitySold).toBe(1)
    expect(bySupplier.find((r) => r.label === 'Supplier A')).toBeUndefined()
    expect(bySupplier.find((r) => r.key === 'unknown')?.quantitySold).toBe(1)

    await db.destroy()
  })
})
