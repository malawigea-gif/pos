import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createSupplier } from '../../../src/main/db/repositories/suppliersRepository'
import {
  createSupplierPayment,
  listSupplierPayments,
  markSupplierPaymentPaid
} from '../../../src/main/db/repositories/supplierPaymentsRepository'

describe('suppliersRepository + supplierPaymentsRepository', () => {
  it('creates a supplier with a zero starting balance', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Vijitha Yapa Distributors', userId: adminId })
    expect(supplier.balance).toBe(0)
    await db.destroy()
  })

  it('an immediately-paid payment reduces the supplier balance right away', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier A', userId: adminId })
    await db.updateTable('suppliers').set({ balance: 5000 }).where('id', '=', supplier.id).execute()

    const payment = await createSupplierPayment(db, {
      supplierId: supplier.id,
      amount: 2000,
      paidImmediately: true,
      userId: adminId
    })
    expect(payment.paid_date).not.toBeNull()

    const stored = await db
      .selectFrom('suppliers')
      .select('balance')
      .where('id', '=', supplier.id)
      .executeTakeFirstOrThrow()
    expect(stored.balance).toBe(3000)

    await db.destroy()
  })

  it('a scheduled (not-yet-paid) payment does not touch the balance until marked paid', async () => {
    const { db, adminId } = await createTestDb()
    const supplier = await createSupplier(db, { name: 'Supplier B', userId: adminId })
    await db.updateTable('suppliers').set({ balance: 5000 }).where('id', '=', supplier.id).execute()

    const payment = await createSupplierPayment(db, {
      supplierId: supplier.id,
      amount: 2000,
      dueDate: '2026-08-01',
      userId: adminId
    })
    expect(payment.paid_date).toBeNull()

    let stored = await db
      .selectFrom('suppliers')
      .select('balance')
      .where('id', '=', supplier.id)
      .executeTakeFirstOrThrow()
    expect(stored.balance).toBe(5000)

    const unpaid = await listSupplierPayments(db, { supplierId: supplier.id, onlyUnpaid: true })
    expect(unpaid).toHaveLength(1)

    await markSupplierPaymentPaid(db, payment.id, adminId)
    stored = await db
      .selectFrom('suppliers')
      .select('balance')
      .where('id', '=', supplier.id)
      .executeTakeFirstOrThrow()
    expect(stored.balance).toBe(3000)

    expect(await listSupplierPayments(db, { supplierId: supplier.id, onlyUnpaid: true })).toHaveLength(0)

    await db.destroy()
  })
})
