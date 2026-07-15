import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import {
  createCategory,
  findOrCreateCategoryByName,
  listCategories
} from '../../../src/main/db/repositories/categoriesRepository'

describe('categoriesRepository', () => {
  it('creates a category and lists it', async () => {
    const { db, adminId } = await createTestDb()

    await createCategory(db, { name: 'Fiction', defaultReorderLevel: 5, userId: adminId })
    const list = await listCategories(db)

    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Fiction', default_reorder_level: 5 })

    await db.destroy()
  })

  it('findOrCreateCategoryByName reuses an existing category instead of duplicating it', async () => {
    const { db, adminId } = await createTestDb()

    const first = await findOrCreateCategoryByName(db, 'Children', adminId)
    const second = await findOrCreateCategoryByName(db, 'Children', adminId)

    expect(second.id).toBe(first.id)
    expect(await listCategories(db)).toHaveLength(1)

    await db.destroy()
  })

  it('records an audit_log entry on category creation', async () => {
    const { db, adminId } = await createTestDb()

    const category = await createCategory(db, { name: 'Academic', userId: adminId })
    const auditRows = await db
      .selectFrom('audit_log')
      .selectAll()
      .where('entity_type', '=', 'categories')
      .where('entity_id', '=', category.id)
      .execute()

    expect(auditRows).toHaveLength(1)
    expect(auditRows[0].action).toBe('create')

    await db.destroy()
  })
})
