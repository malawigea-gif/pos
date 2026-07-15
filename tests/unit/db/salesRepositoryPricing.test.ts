import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createTaxRate } from '../../../src/main/db/repositories/taxRatesRepository'
import { createDiscount } from '../../../src/main/db/repositories/discountsRepository'
import { checkoutSale, holdSale } from '../../../src/main/db/repositories/salesRepository'

describe('checkoutSale — discount/tax integration', () => {
  it('persists computed discount/tax amounts on the sale and its line items', async () => {
    const { db, adminId } = await createTestDb()
    const vat = await createTaxRate(db, { name: 'VAT', ratePercent: 10, userId: adminId })
    const book = await createBook(db, {
      title: 'Taxed Discounted Book',
      costPrice: 100,
      sellingPrice: 1000,
      taxRateId: vat.id,
      initialStockQty: 5,
      userId: adminId
    })
    await createDiscount(db, { name: 'Sale', type: 'percent', value: 20, scope: 'all', userId: adminId })

    // gross 1000, 20% off -> discount 200, net 800, 10% tax on 800 = 80, total 880
    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      payments: [{ method: 'cash', amount: 880 }],
      userId: adminId
    })

    expect(result.sale.subtotal).toBe(1000)
    expect(result.sale.discount_total).toBe(200)
    expect(result.sale.tax_total).toBe(80)
    expect(result.sale.total).toBe(880)
    expect(result.items[0].discount_amount).toBe(200)
    expect(result.items[0].tax_amount).toBe(80)
    expect(result.items[0].line_total).toBe(880)

    await db.destroy()
  })

  it('recomputes pricing at completion time for a resumed held sale', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 1000,
      initialStockQty: 5,
      userId: adminId
    })

    const held = await holdSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      userId: adminId
    })
    // No discount existed at hold time.
    expect(held.discount_total).toBe(0)

    // A discount appears before the sale is actually completed.
    await createDiscount(db, { name: 'Late Sale', type: 'percent', value: 30, scope: 'all', userId: adminId })

    const completed = await checkoutSale(db, {
      heldSaleId: held.id,
      payments: [{ method: 'cash', amount: 700 }],
      userId: adminId
    })

    expect(completed.sale.discount_total).toBe(300)
    expect(completed.sale.total).toBe(700)
    expect(completed.items[0].discount_amount).toBe(300)

    await db.destroy()
  })
})
