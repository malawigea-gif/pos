import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import {
  createDiscount,
  listDiscounts,
  setDiscountActive,
  updateDiscount
} from '../../../src/main/db/repositories/discountsRepository'

describe('discountsRepository', () => {
  it('creates a store-wide percent discount', async () => {
    const { db, adminId } = await createTestDb()
    const discount = await createDiscount(db, {
      name: 'Exam Season Sale',
      type: 'percent',
      value: 10,
      scope: 'all',
      userId: adminId
    })
    expect(discount.scope).toBe('all')
    expect(await listDiscounts(db)).toHaveLength(1)
    await db.destroy()
  })

  it('clears book_id/category_id fields that do not match the chosen scope', async () => {
    const { db, adminId } = await createTestDb()
    const category = await createCategory(db, { name: 'Fiction', userId: adminId })
    const book = await createBook(db, {
      title: 'Some Book',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })

    const discount = await createDiscount(db, {
      name: 'Category Sale',
      type: 'fixed',
      value: 50,
      scope: 'category',
      bookId: book.id, // should be ignored since scope is 'category', not 'item'
      categoryId: category.id,
      userId: adminId
    })
    expect(discount.book_id).toBeNull()
    expect(discount.category_id).toBe(category.id)
    await db.destroy()
  })

  it('updateDiscount records a diff and setDiscountActive toggles visibility', async () => {
    const { db, adminId } = await createTestDb()
    const discount = await createDiscount(db, {
      name: 'Original',
      type: 'percent',
      value: 5,
      scope: 'all',
      userId: adminId
    })

    const updated = await updateDiscount(db, discount.id, {
      name: 'Renamed',
      type: 'percent',
      value: 15,
      scope: 'all',
      userId: adminId
    })
    expect(updated.value).toBe(15)

    const deactivated = await setDiscountActive(db, discount.id, false, adminId)
    expect(deactivated.is_active).toBe(0)

    await db.destroy()
  })
})
