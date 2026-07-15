import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import {
  adjustStock,
  getMovementHistory,
  InsufficientStockError
} from '../../../src/main/db/repositories/stockRepository'

describe('stockRepository', () => {
  it('adjustStock updates the book quantity and writes a movement + audit row', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Test Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: adminId
    })

    await adjustStock(db, {
      bookId: book.id,
      changeQty: 3,
      movementType: 'grn',
      userId: adminId,
      notes: 'Restock'
    })

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(8)

    const history = await getMovementHistory(db, book.id)
    // one row from initial stock creation, one from this adjustment
    expect(history).toHaveLength(2)
    expect(history[0].movement_type).toBe('grn')

    await db.destroy()
  })

  it('rejects an adjustment that would push stock negative by default', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Scarce Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 2,
      userId: adminId
    })

    await expect(
      adjustStock(db, {
        bookId: book.id,
        changeQty: -5,
        movementType: 'write_off',
        userId: adminId
      })
    ).rejects.toBeInstanceOf(InsufficientStockError)

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(2)

    await db.destroy()
  })

  it('allows a negative result when allowNegative is set', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Corrective Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 2,
      userId: adminId
    })

    await adjustStock(db, {
      bookId: book.id,
      changeQty: -5,
      movementType: 'adjustment',
      userId: adminId,
      allowNegative: true
    })

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(-3)

    await db.destroy()
  })
})
