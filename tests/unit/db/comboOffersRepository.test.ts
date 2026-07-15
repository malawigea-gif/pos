import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import {
  createComboOffer,
  listComboOffers,
  setComboOfferActive,
  updateComboOffer
} from '../../../src/main/db/repositories/comboOffersRepository'

describe('comboOffersRepository', () => {
  it('creates a buy-2-get-1 combo offer scoped to an item', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Combo Book', costPrice: 100, sellingPrice: 200, userId: adminId })

    const combo = await createComboOffer(db, {
      name: 'Buy 2 Get 1 Free',
      buyQuantity: 2,
      freeQuantity: 1,
      scope: 'item',
      bookId: book.id,
      userId: adminId
    })
    expect(combo.buy_quantity).toBe(2)
    expect(combo.free_quantity).toBe(1)
    expect(combo.category_id).toBeNull()
    expect(await listComboOffers(db)).toHaveLength(1)
    await db.destroy()
  })

  it('updateComboOffer and setComboOfferActive work as expected', async () => {
    const { db, adminId } = await createTestDb()
    const category = await createCategory(db, { name: 'Fiction', userId: adminId })

    const combo = await createComboOffer(db, {
      name: 'Original',
      buyQuantity: 3,
      freeQuantity: 1,
      scope: 'category',
      categoryId: category.id,
      userId: adminId
    })

    const updated = await updateComboOffer(db, combo.id, {
      name: 'Updated',
      buyQuantity: 2,
      freeQuantity: 1,
      scope: 'category',
      categoryId: category.id,
      userId: adminId
    })
    expect(updated.buy_quantity).toBe(2)

    const deactivated = await setComboOfferActive(db, combo.id, false, adminId)
    expect(deactivated.is_active).toBe(0)

    await db.destroy()
  })
})
