import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createCustomer } from '../../../src/main/db/repositories/customersRepository'
import { setSetting } from '../../../src/main/db/repositories/settingsRepository'
import {
  checkoutSale,
  CreditNotAllowedError,
  InsufficientCreditError
} from '../../../src/main/db/repositories/salesRepository'

describe('checkoutSale — customer, credit, and loyalty integration', () => {
  it('accrues loyalty points for the selected customer based on the configured rate', async () => {
    const { db, adminId } = await createTestDb()
    await setSetting(db, 'loyalty.pointsPerCurrency', '0.01', adminId)
    const customer = await createCustomer(db, { name: 'Loyal Customer', userId: adminId })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 1000,
      initialStockQty: 5,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      payments: [{ method: 'cash', amount: 1000 }],
      customerId: customer.id,
      userId: adminId
    })

    const stored = await db
      .selectFrom('customers')
      .select('loyalty_points')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(stored.loyalty_points).toBe(10) // floor(1000 * 0.01)

    await db.destroy()
  })

  it('does not accrue points when no rate is configured', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Customer', userId: adminId })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 1000,
      initialStockQty: 5,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 1000 }],
      payments: [{ method: 'cash', amount: 1000 }],
      customerId: customer.id,
      userId: adminId
    })

    const stored = await db
      .selectFrom('customers')
      .select('loyalty_points')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(stored.loyalty_points).toBe(0)

    await db.destroy()
  })

  it('allows a credit payment within the available limit and increases the balance owed', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, {
      name: 'Credit Customer',
      isCreditAccount: true,
      creditLimit: 5000,
      userId: adminId
    })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 2000,
      initialStockQty: 5,
      userId: adminId
    })

    await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 2000 }],
      payments: [{ method: 'credit', amount: 2000 }],
      customerId: customer.id,
      userId: adminId
    })

    const stored = await db
      .selectFrom('customers')
      .select('credit_balance')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(stored.credit_balance).toBe(2000)

    await db.destroy()
  })

  it('rejects a credit payment that exceeds available credit', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, {
      name: 'Maxed Out Customer',
      isCreditAccount: true,
      creditLimit: 1000,
      userId: adminId
    })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 2000,
      initialStockQty: 5,
      userId: adminId
    })

    await expect(
      checkoutSale(db, {
        items: [{ bookId: book.id, quantity: 1, unitPrice: 2000 }],
        payments: [{ method: 'credit', amount: 2000 }],
        customerId: customer.id,
        userId: adminId
      })
    ).rejects.toBeInstanceOf(InsufficientCreditError)

    await db.destroy()
  })

  it('rejects a credit payment when no customer is selected', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 2000,
      initialStockQty: 5,
      userId: adminId
    })

    await expect(
      checkoutSale(db, {
        items: [{ bookId: book.id, quantity: 1, unitPrice: 2000 }],
        payments: [{ method: 'credit', amount: 2000 }],
        userId: adminId
      })
    ).rejects.toBeInstanceOf(CreditNotAllowedError)

    await db.destroy()
  })

  it('rejects a credit payment for a customer without a credit account', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Non-Credit Customer', userId: adminId })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 2000,
      initialStockQty: 5,
      userId: adminId
    })

    await expect(
      checkoutSale(db, {
        items: [{ bookId: book.id, quantity: 1, unitPrice: 2000 }],
        payments: [{ method: 'credit', amount: 2000 }],
        customerId: customer.id,
        userId: adminId
      })
    ).rejects.toBeInstanceOf(CreditNotAllowedError)

    await db.destroy()
  })
})
