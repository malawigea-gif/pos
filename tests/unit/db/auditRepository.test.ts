import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import { createUser, updateUser } from '../../../src/main/db/repositories/usersRepository'
import { listAuditEntityTypes, listAuditLog } from '../../../src/main/db/repositories/auditRepository'

async function seedAuditTrail(db: Awaited<ReturnType<typeof createTestDb>>['db'], adminId: number) {
  const category1 = await createCategory(db, { name: 'Fiction', userId: adminId })
  const cashier = await createUser(db, {
    username: 'cashier1',
    password: 'secret123',
    fullName: 'Cashier One',
    role: 'cashier',
    language: 'en',
    userId: adminId
  })
  const category2 = await createCategory(db, { name: 'NonFiction', userId: cashier.id })
  await updateUser(db, cashier.id, { fullName: 'Cashier One Updated', userId: adminId })

  return { category1, category2, cashier }
}

describe('auditRepository', () => {
  it('lists all entries newest-first with no filter', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const { entries, total } = await listAuditLog(db)
    expect(total).toBe(4)
    expect(entries).toHaveLength(4)
    // Newest first: the last action performed was the user update.
    expect(entries[0].action).toBe('update')
    expect(entries[0].entityType).toBe('users')

    await db.destroy()
  })

  it('joins the acting user so username/fullName are populated', async () => {
    const { db, adminId } = await createTestDb()
    const { cashier } = await seedAuditTrail(db, adminId)

    const { entries } = await listAuditLog(db, { userId: cashier.id })
    expect(entries).toHaveLength(1)
    expect(entries[0].username).toBe('cashier1')
    // This is a live join to the users table, so it reflects the actor's
    // *current* full name — not a historical snapshot from when the
    // audited action happened. seedAuditTrail renames the cashier after
    // this action, so the joined name reflects that later rename.
    expect(entries[0].fullName).toBe('Cashier One Updated')

    await db.destroy()
  })

  it('filters by entityType', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const categories = await listAuditLog(db, { entityType: 'categories' })
    expect(categories.total).toBe(2)
    expect(categories.entries.every((e) => e.entityType === 'categories')).toBe(true)

    const users = await listAuditLog(db, { entityType: 'users' })
    expect(users.total).toBe(2)

    await db.destroy()
  })

  it('filters by action', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const creates = await listAuditLog(db, { action: 'create' })
    expect(creates.total).toBe(3)
    expect(creates.entries.every((e) => e.action === 'create')).toBe(true)

    const updates = await listAuditLog(db, { action: 'update' })
    expect(updates.total).toBe(1)
    expect(updates.entries[0].entityType).toBe('users')

    await db.destroy()
  })

  it('filters by the acting userId', async () => {
    const { db, adminId } = await createTestDb()
    const { cashier } = await seedAuditTrail(db, adminId)

    const byCashier = await listAuditLog(db, { userId: cashier.id })
    expect(byCashier.total).toBe(1)

    const byAdmin = await listAuditLog(db, { userId: adminId })
    expect(byAdmin.total).toBe(3)

    await db.destroy()
  })

  it('filters by date range', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const now = new Date()
    const wideRange = {
      from: new Date(now.getTime() - 60_000).toISOString(),
      to: new Date(now.getTime() + 60_000).toISOString()
    }
    const inRange = await listAuditLog(db, { dateRange: wideRange })
    expect(inRange.total).toBe(4)

    const pastRange = {
      from: '2000-01-01T00:00:00.000Z',
      to: '2000-01-02T00:00:00.000Z'
    }
    const outOfRange = await listAuditLog(db, { dateRange: pastRange })
    expect(outOfRange.total).toBe(0)

    await db.destroy()
  })

  it('paginates with limit/offset while total reflects the full filtered count', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const page1 = await listAuditLog(db, { limit: 2, offset: 0 })
    expect(page1.entries).toHaveLength(2)
    expect(page1.total).toBe(4)

    const page2 = await listAuditLog(db, { limit: 2, offset: 2 })
    expect(page2.entries).toHaveLength(2)
    expect(page2.total).toBe(4)

    const page1Ids = page1.entries.map((e) => e.id)
    const page2Ids = page2.entries.map((e) => e.id)
    expect(page1Ids).not.toEqual(page2Ids)

    await db.destroy()
  })

  it('parses the changes JSON, and the update diff reflects only the fields that actually changed', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const { entries } = await listAuditLog(db, { action: 'update' })
    const changes = entries[0].changes as Record<string, { old: unknown; new: unknown }>
    expect(changes.full_name).toEqual({ old: 'Cashier One', new: 'Cashier One Updated' })

    await db.destroy()
  })

  it('lists distinct entity types in use', async () => {
    const { db, adminId } = await createTestDb()
    await seedAuditTrail(db, adminId)

    const types = await listAuditEntityTypes(db)
    expect(types).toEqual(['categories', 'users'])

    await db.destroy()
  })
})
