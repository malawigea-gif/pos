import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import { createTaxRate } from '../../../src/main/db/repositories/taxRatesRepository'
import { createDiscount } from '../../../src/main/db/repositories/discountsRepository'
import { createComboOffer } from '../../../src/main/db/repositories/comboOffersRepository'
import { computeSalePricing } from '../../../src/main/pricing/computeSalePricing'

describe('computeSalePricing', () => {
  it('applies no discount/tax when nothing is configured beyond the exempt default', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Plain Book', costPrice: 100, sellingPrice: 500, userId: adminId })

    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 2, unitPrice: 500 }])

    expect(pricing.subtotal).toBe(1000)
    expect(pricing.discountTotal).toBe(0)
    expect(pricing.taxTotal).toBe(0)
    expect(pricing.total).toBe(1000)

    await db.destroy()
  })

  it('computes tax from the book tax rate when it is not exempt', async () => {
    const { db, adminId } = await createTestDb()
    const vat = await createTaxRate(db, { name: 'VAT', ratePercent: 18, userId: adminId })
    const book = await createBook(db, {
      title: 'Taxed Item',
      costPrice: 100,
      sellingPrice: 1000,
      taxRateId: vat.id,
      userId: adminId
    })

    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 1, unitPrice: 1000 }])

    expect(pricing.taxTotal).toBe(180)
    expect(pricing.total).toBe(1180)

    await db.destroy()
  })

  it('applies a store-wide percent discount and taxes the discounted amount', async () => {
    const { db, adminId } = await createTestDb()
    const vat = await createTaxRate(db, { name: 'VAT', ratePercent: 10, userId: adminId })
    const book = await createBook(db, {
      title: 'Discounted Item',
      costPrice: 100,
      sellingPrice: 1000,
      taxRateId: vat.id,
      userId: adminId
    })
    await createDiscount(db, { name: 'Store Sale', type: 'percent', value: 20, scope: 'all', userId: adminId })

    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 1, unitPrice: 1000 }])

    // gross 1000, 20% off -> discount 200, net 800, tax 10% of 800 = 80
    expect(pricing.discountTotal).toBe(200)
    expect(pricing.taxTotal).toBe(80)
    expect(pricing.total).toBe(880)

    await db.destroy()
  })

  it('applies a fixed per-unit discount capped at the line amount', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 100, sellingPrice: 300, userId: adminId })
    await createDiscount(db, {
      name: 'Fixed Off',
      type: 'fixed',
      value: 500, // deliberately larger than the line total to test capping
      scope: 'item',
      bookId: book.id,
      userId: adminId
    })

    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 1, unitPrice: 300 }])

    expect(pricing.discountTotal).toBe(300) // capped, not 500
    expect(pricing.total).toBe(0)

    await db.destroy()
  })

  it('gives free units for a buy-2-get-1 combo offer', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Combo Item', costPrice: 100, sellingPrice: 200, userId: adminId })
    await createComboOffer(db, {
      name: 'Buy 2 Get 1',
      buyQuantity: 2,
      freeQuantity: 1,
      scope: 'item',
      bookId: book.id,
      userId: adminId
    })

    // 6 units = 2 groups of 3 -> 2 free units
    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 6, unitPrice: 200 }])

    expect(pricing.subtotal).toBe(1200)
    expect(pricing.discountTotal).toBe(400) // 2 free units * 200
    expect(pricing.total).toBe(800)

    await db.destroy()
  })

  it('prefers an item-specific discount over a category or store-wide one', async () => {
    const { db, adminId } = await createTestDb()
    const category = await createCategory(db, { name: 'Fiction', userId: adminId })
    const book = await createBook(db, {
      title: 'Specific Book',
      costPrice: 100,
      sellingPrice: 1000,
      categoryId: category.id,
      userId: adminId
    })

    await createDiscount(db, { name: 'Store Wide', type: 'percent', value: 5, scope: 'all', userId: adminId })
    await createDiscount(db, {
      name: 'Category Sale',
      type: 'percent',
      value: 10,
      scope: 'category',
      categoryId: category.id,
      userId: adminId
    })
    await createDiscount(db, {
      name: 'Item Sale',
      type: 'percent',
      value: 25,
      scope: 'item',
      bookId: book.id,
      userId: adminId
    })

    const pricing = await computeSalePricing(db, [{ bookId: book.id, quantity: 1, unitPrice: 1000 }])

    expect(pricing.discountTotal).toBe(250) // the 25% item-level discount, not 5% or 10%

    await db.destroy()
  })

  it('ignores discounts outside their active date window', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 100, sellingPrice: 1000, userId: adminId })

    await createDiscount(db, {
      name: 'Expired',
      type: 'percent',
      value: 50,
      scope: 'all',
      endsAt: '2020-01-01T00:00:00.000Z',
      userId: adminId
    })
    await createDiscount(db, {
      name: 'Not Started Yet',
      type: 'percent',
      value: 50,
      scope: 'all',
      startsAt: '2099-01-01T00:00:00.000Z',
      userId: adminId
    })

    const pricing = await computeSalePricing(
      db,
      [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      new Date('2026-06-01T00:00:00.000Z')
    )

    expect(pricing.discountTotal).toBe(0)

    await db.destroy()
  })

  it('applies a currently-active time-limited discount within its window', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 100, sellingPrice: 1000, userId: adminId })

    await createDiscount(db, {
      name: 'Exam Season Sale',
      type: 'percent',
      value: 15,
      scope: 'all',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-12-31T23:59:59.000Z',
      userId: adminId
    })

    const pricing = await computeSalePricing(
      db,
      [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      new Date('2026-06-01T00:00:00.000Z')
    )

    expect(pricing.discountTotal).toBe(150)

    await db.destroy()
  })

  it('only applies a wholesale (min quantity) discount once the line reaches the threshold', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Bulk Item', costPrice: 100, sellingPrice: 100, userId: adminId })
    await createDiscount(db, {
      name: 'Buy 10+',
      type: 'percent',
      value: 20,
      scope: 'all',
      minQuantity: 10,
      userId: adminId
    })

    const belowThreshold = await computeSalePricing(db, [{ bookId: book.id, quantity: 9, unitPrice: 100 }])
    expect(belowThreshold.discountTotal).toBe(0)

    const atThreshold = await computeSalePricing(db, [{ bookId: book.id, quantity: 10, unitPrice: 100 }])
    expect(atThreshold.discountTotal).toBe(200) // 20% of 1000

    await db.destroy()
  })

  it('only applies a loyalty-customer discount when the sale has a customer selected', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 100, sellingPrice: 1000, userId: adminId })
    const customer = await db
      .insertInto('customers')
      .values({ name: 'Loyal Customer', loyalty_points: 0, is_credit_account: 0, credit_limit: 0, credit_balance: 0 })
      .returningAll()
      .executeTakeFirstOrThrow()
    await createDiscount(db, {
      name: 'Loyalty Only',
      type: 'percent',
      value: 10,
      scope: 'all',
      requiresLoyaltyCustomer: true,
      userId: adminId
    })

    const walkIn = await computeSalePricing(db, [{ bookId: book.id, quantity: 1, unitPrice: 1000 }])
    expect(walkIn.discountTotal).toBe(0)

    const loyaltySale = await computeSalePricing(
      db,
      [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      new Date(),
      customer.id
    )
    expect(loyaltySale.discountTotal).toBe(100)

    await db.destroy()
  })

  // Regression: a cashier's manual Discount Price override (QtyModal) is
  // the deliberate final say on that line's price — an automatic discount
  // or combo rule must NOT also apply on top of it, or the line gets
  // discounted twice. See the "Show Price / Subtotal / Discount Per Line"
  // prompt's STEP 0 trace and decision.
  //
  // Also covers the Subtotal/Profit bill bug: subtotal/discountAmount must
  // be reckoned against the book's *list* price (100), not the manually
  // charged one (70) — using the charged price as "gross" silently folds
  // the manual discount into Subtotal, making it look pre-discounted and
  // making the automatic-discount exemption below indistinguishable from
  // "no discount at all" at the bill-total level.
  it('exempts a manually-priced line from an otherwise-applicable store-wide discount', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 50, sellingPrice: 100, userId: adminId })
    await createDiscount(db, { name: 'Store Sale', type: 'percent', value: 10, scope: 'all', userId: adminId })

    // Cashier manually discounts 100 -> 70 in QtyModal.
    const overridden = await computeSalePricing(db, [
      { bookId: book.id, quantity: 1, unitPrice: 70, priceOverridden: true }
    ])
    expect(overridden.subtotal).toBe(100) // list price, not the charged 70
    expect(overridden.discountTotal).toBe(30) // the manual discount (100-70), not the automatic 10%
    expect(overridden.items[0].discountAmount).toBe(30)
    expect(overridden.items[0].lineTotal).toBe(70) // exactly the manual price, not 63
    expect(overridden.total).toBe(70) // subtotal - discountTotal reconciles: 100 - 30

    // An un-overridden line at the same charged price still gets the
    // automatic discount normally — proves the exemption is keyed off the
    // flag, not just a coincidentally-lower unitPrice.
    const notOverridden = await computeSalePricing(db, [
      { bookId: book.id, quantity: 1, unitPrice: 70, priceOverridden: false }
    ])
    expect(notOverridden.items[0].discountAmount).toBe(7) // 10% of 70
    expect(notOverridden.items[0].lineTotal).toBe(63)

    await db.destroy()
  })

  it('exempts a manually-priced line from an otherwise-applicable combo offer', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Combo Item', costPrice: 50, sellingPrice: 200, userId: adminId })
    await createComboOffer(db, {
      name: 'Buy 2 Get 1',
      buyQuantity: 2,
      freeQuantity: 1,
      scope: 'item',
      bookId: book.id,
      userId: adminId
    })

    const overridden = await computeSalePricing(db, [
      { bookId: book.id, quantity: 6, unitPrice: 180, priceOverridden: true }
    ])
    expect(overridden.subtotal).toBe(1200) // 6 * list price 200, no free units applied
    expect(overridden.discountTotal).toBe(120) // the manual discount (200-180)*6, not a combo
    expect(overridden.total).toBe(1080) // 6 * 180, unchanged by the combo

    await db.destroy()
  })

  // Exact repro from the "Subtotal/Profit wrong on a bill with a per-unit
  // discount" bug report: 2 units at list 4500, manually discounted to
  // 4000 each. Subtotal must stay the pre-discount sum (9000); the manual
  // discount (1000) must show up in discountTotal so Total (8000) is
  // reached by actually subtracting it, not by Subtotal already being net.
  it('keeps Subtotal as the pre-discount sum for a per-unit manual discount across multiple units', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Repro Book', costPrice: 3500, sellingPrice: 4500, userId: adminId })

    const pricing = await computeSalePricing(db, [
      { bookId: book.id, quantity: 2, unitPrice: 4000, priceOverridden: true }
    ])

    expect(pricing.subtotal).toBe(9000)
    expect(pricing.discountTotal).toBe(1000)
    expect(pricing.taxTotal).toBe(0)
    expect(pricing.total).toBe(8000)

    await db.destroy()
  })
})
