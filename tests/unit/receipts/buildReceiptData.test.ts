import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { checkoutSale } from '../../../src/main/db/repositories/salesRepository'
import { createQuotation, getQuotationWithItems } from '../../../src/main/db/repositories/quotationsRepository'
import { buildReceiptData, buildQuotationReceiptData } from '../../../src/main/receipts/buildReceiptData'
import { buildReceiptHtml } from '../../../src/main/receipts/receiptHtml'
import { getSession, login, logout } from '../../../src/main/auth/session'
import { createUser } from '../../../src/main/db/repositories/usersRepository'

afterEach(() => {
  logout()
})

describe('buildReceiptData — profit', () => {
  it('computes profit as (discount price - cost price) * quantity for an admin, primary unit', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Primary Unit Book',
      costPrice: 60,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })

    // Cashier discounted 100 -> 90 at the point of sale.
    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 3, unitPrice: 90 }],
      payments: [{ method: 'cash', amount: 270 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBe((90 - 60) * 3)
    await db.destroy()
  })

  it('uses the secondary-unit cost price when the secondary unit was sold', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Fabric',
      costPrice: 100,
      sellingPrice: 120,
      unitType: 'length',
      secondaryUnitCostPrice: 95,
      secondaryUnitSellingPrice: 110,
      secondaryUnitFactor: 0.9144,
      initialStockQty: 50,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [
        {
          bookId: book.id,
          quantity: 4,
          unitPrice: 105,
          unitLabel: 'yard',
          stockQuantity: 4 * 0.9144
        }
      ],
      payments: [{ method: 'cash', amount: 420 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBe((105 - 95) * 4)
    await db.destroy()
  })

  it('is negative when the cashier discounted below cost — not clamped to zero', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Discounted Below Cost',
      costPrice: 100,
      sellingPrice: 150,
      initialStockQty: 5,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 80 }],
      payments: [{ method: 'cash', amount: 160 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBe((80 - 100) * 2)
    expect(data.profit).toBeLessThan(0)
    await db.destroy()
  })

  it('is null for a cashier — profit is admin/manager only', async () => {
    const { db, adminId } = await createTestDb()
    await createUser(db, {
      username: 'checkout-cashier',
      password: 'password123',
      fullName: 'Test Cashier',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 60,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })
    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'cash', amount: 100 }],
      userId: adminId
    })

    // Whoever is *viewing/printing* the receipt right now decides
    // visibility — log in as the cashier only after the sale exists.
    await login(db, 'checkout-cashier', 'password123')
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBeNull()
    await db.destroy()
  })

  it('is null when no session is active', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 60,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })
    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'cash', amount: 100 }],
      userId: adminId
    })

    expect(getSession()).toBeNull()
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBeNull()
    await db.destroy()
  })
})

describe('buildReceiptData — Price / Subtotal / Discount per line', () => {
  it('matches the worked example: item price 100, Discount Price 70, qty 1 -> Price 100 / Subtotal 70 / Discount 30', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Worked Example Book',
      costPrice: 40,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 70, priceOverridden: true }],
      payments: [{ method: 'cash', amount: 70 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.items).toHaveLength(1)
    const [item] = data.items
    expect(item.defaultUnitPrice).toBe(100)
    expect(item.unitPrice * item.quantity).toBe(70) // Subtotal
    expect((item.defaultUnitPrice - item.unitPrice) * item.quantity).toBe(30) // Discount
    await db.destroy()
  })

  it('scales Subtotal and Discount with quantity: qty 2 -> Price 100 / Subtotal 140 / Discount 60', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Worked Example Book Qty 2',
      costPrice: 40,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 70, priceOverridden: true }],
      payments: [{ method: 'cash', amount: 140 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    const [item] = data.items
    expect(item.defaultUnitPrice).toBe(100)
    expect(item.unitPrice * item.quantity).toBe(140)
    expect((item.defaultUnitPrice - item.unitPrice) * item.quantity).toBe(60)
    await db.destroy()
  })

  it('has zero Discount when the cashier did not override the price', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'No Discount Book',
      costPrice: 40,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 3, unitPrice: 100 }],
      payments: [{ method: 'cash', amount: 300 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    const [item] = data.items
    expect(item.defaultUnitPrice).toBe(100)
    expect((item.defaultUnitPrice - item.unitPrice) * item.quantity).toBe(0)
    await db.destroy()
  })
})

// Exact repro from the "Subtotal/Profit wrong on a bill with a per-unit
// discount" bug report: 2 units of the same item, list price 4500, manually
// discounted to 4000 each (Rs. 500/unit, Rs. 1000 total), cash tender
// 10000. Every bill figure is asserted so a future regression on any one
// of them (not just the two that were originally visibly wrong) gets
// caught here.
describe('buildReceiptData — bill-level Subtotal/Discount/Total/Profit for a per-unit manual discount', () => {
  it('matches the worked example: Subtotal 9000 / Discount -1000 / Total 8000 / Paid 10000 / Balance 2000 / Profit 1000', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Repro Book',
      costPrice: 3500,
      sellingPrice: 4500,
      initialStockQty: 10,
      userId: adminId
    })

    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 4000, priceOverridden: true }],
      payments: [{ method: 'cash', amount: 10000 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.subtotal).toBe(9000) // pre-discount sum of line totals, not 8000
    expect(data.discountTotal).toBe(1000)
    expect(data.total).toBe(8000)
    expect(data.amountPaid).toBe(10000)
    expect(data.change).toBe(2000)
    expect(data.profit).toBe(1000) // (4000 - 3500) * 2, not a duplicate of Total

    await db.destroy()
  })
})

describe('buildQuotationReceiptData — profit', () => {
  it('is always null, even for an admin — quotations are estimates, not realized sales', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 60,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })
    const quotation = await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 100 }],
      userId: adminId
    })
    const withItems = await getQuotationWithItems(db, quotation.id)
    const data = await buildQuotationReceiptData(db, withItems.quotation, withItems.items, 'en')

    expect(data.profit).toBeNull()
    await db.destroy()
  })
})

// STEP 3 sanity check: proves Profit in its new Section C (payment block)
// location reflects a real, non-zero (chargedPrice - costPrice) * quantity
// from an actual checkout — not a coincidence carried over from a dev
// item's cost price happening to be 0 (which would make profit == total,
// impossible to distinguish from a display bug by eye alone).
describe('Profit end-to-end through checkout -> buildReceiptData -> buildReceiptHtml, in its new Section C location', () => {
  it('renders the real computed profit in the payment block, not the totals block, for an item with a genuine non-zero cost price', async () => {
    const { db, adminId } = await createTestDb()
    await login(db, 'admin', 'admin123')
    const book = await createBook(db, {
      title: 'Real Cost Price Book',
      costPrice: 350,
      sellingPrice: 500,
      initialStockQty: 10,
      userId: adminId
    })

    // No manual discount — charged at the normal price, so profit is
    // unambiguously (500 - 350) * 4 = 600, nowhere near the sale total
    // (2000), ruling out any "profit == total" coincidence.
    const result = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 4, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 2000 }],
      userId: adminId
    })
    const data = await buildReceiptData(db, result.sale, result.items, result.payments, 'en')

    expect(data.profit).toBe(600)
    expect(data.profit).not.toBe(data.total)

    const html = buildReceiptHtml(data, '80mm')
    const totalsBlocks = [...html.matchAll(/<table class="totals">([\s\S]*?)<\/table>/g)]

    expect(totalsBlocks).toHaveLength(2)
    expect(totalsBlocks[0][1]).not.toContain('Profit') // Section B: no longer here
    expect(totalsBlocks[1][1]).toContain('Profit') // Section C: alongside Paid/Change
    expect(totalsBlocks[1][1]).toContain('600.00')

    await db.destroy()
  })
})
