import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import {
  adjustLoyaltyPoints,
  createCustomer,
  InsufficientLoyaltyPointsError,
  listLoyaltyTransactions,
  recordCreditPayment,
  updateCustomer
} from '../../../src/main/db/repositories/customersRepository'

describe('customersRepository', () => {
  it('creates a customer with credit fields and lists it', async () => {
    const { db, adminId } = await createTestDb()

    const customer = await createCustomer(db, {
      name: 'Green Valley School',
      isCreditAccount: true,
      creditLimit: 50000,
      userId: adminId
    })

    expect(customer.is_credit_account).toBe(1)
    expect(customer.credit_limit).toBe(50000)
    expect(customer.credit_balance).toBe(0)

    await db.destroy()
  })

  it('updateCustomer records a diff and persists changes', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Original Name', userId: adminId })

    const updated = await updateCustomer(db, customer.id, {
      name: 'Updated Name',
      creditLimit: 1000,
      userId: adminId
    })
    expect(updated.name).toBe('Updated Name')

    const auditRows = await db
      .selectFrom('audit_log')
      .selectAll()
      .where('entity_type', '=', 'customers')
      .where('entity_id', '=', customer.id)
      .where('action', '=', 'update')
      .execute()
    expect(auditRows).toHaveLength(1)

    await db.destroy()
  })

  it('recordCreditPayment reduces the credit balance', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, {
      name: 'Credit Customer',
      isCreditAccount: true,
      creditLimit: 10000,
      userId: adminId
    })
    await db
      .updateTable('customers')
      .set({ credit_balance: 3000 })
      .where('id', '=', customer.id)
      .execute()

    const updated = await recordCreditPayment(db, { customerId: customer.id, amount: 1200, userId: adminId })
    expect(updated.credit_balance).toBe(1800)

    await db.destroy()
  })

  it('adjustLoyaltyPoints accrues points and logs a loyalty_transactions row', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Loyal Customer', userId: adminId })

    const newPoints = await adjustLoyaltyPoints(db, {
      customerId: customer.id,
      pointsChange: 50,
      reason: 'Purchase',
      userId: adminId
    })
    expect(newPoints).toBe(50)

    const transactions = await listLoyaltyTransactions(db, customer.id)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].points_change).toBe(50)

    await db.destroy()
  })

  it('rejects redeeming more loyalty points than the customer has', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Low Points Customer', userId: adminId })
    await adjustLoyaltyPoints(db, { customerId: customer.id, pointsChange: 10, reason: 'Bonus', userId: adminId })

    await expect(
      adjustLoyaltyPoints(db, {
        customerId: customer.id,
        pointsChange: -20,
        reason: 'Redeem',
        userId: adminId
      })
    ).rejects.toBeInstanceOf(InsufficientLoyaltyPointsError)

    const stored = await db
      .selectFrom('customers')
      .select('loyalty_points')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(stored.loyalty_points).toBe(10)

    await db.destroy()
  })
})
