import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createCustomer } from '../../../src/main/db/repositories/customersRepository'
import {
  createPreorder,
  listPreorders,
  updatePreorderStatus
} from '../../../src/main/db/repositories/preordersRepository'

describe('preordersRepository', () => {
  it('creates a preorder and lists it joined with the customer name', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Waiting Customer', userId: adminId })

    await createPreorder(db, {
      customerId: customer.id,
      title: 'Out of Stock Title',
      quantity: 2,
      userId: adminId
    })

    const list = await listPreorders(db)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Out of Stock Title',
      quantity: 2,
      status: 'pending',
      customer_name: 'Waiting Customer'
    })

    await db.destroy()
  })

  it('updatePreorderStatus transitions status and audits it', async () => {
    const { db, adminId } = await createTestDb()
    const customer = await createCustomer(db, { name: 'Customer', userId: adminId })
    const preorder = await createPreorder(db, {
      customerId: customer.id,
      title: 'Title',
      userId: adminId
    })

    const notified = await updatePreorderStatus(db, preorder.id, 'notified', adminId)
    expect(notified.status).toBe('notified')

    const filtered = await listPreorders(db, { status: 'notified' })
    expect(filtered).toHaveLength(1)

    await db.destroy()
  })
})
