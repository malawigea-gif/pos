import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import {
  completeStockTake,
  IncompleteStockTakeError,
  listStockTakeItems,
  recordCount,
  startStockTake
} from '../../../src/main/db/repositories/stockTakeRepository'

describe('stockTakeRepository', () => {
  it('snapshots expected quantities for all active books on start', async () => {
    const { db, adminId } = await createTestDb()
    await createBook(db, {
      title: 'Book A',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })
    await createBook(db, {
      title: 'Book B',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 4,
      userId: adminId
    })

    const stockTake = await startStockTake(db, adminId)
    const items = await listStockTakeItems(db, stockTake.id)

    expect(items).toHaveLength(2)
    expect(items.find((i) => i.book_title === 'Book A')?.expected_qty).toBe(10)
    expect(items.every((i) => i.counted_qty === null)).toBe(true)

    await db.destroy()
  })

  it('refuses to complete while items are still uncounted', async () => {
    const { db, adminId } = await createTestDb()
    await createBook(db, {
      title: 'Uncounted Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: adminId
    })
    const stockTake = await startStockTake(db, adminId)

    await expect(completeStockTake(db, stockTake.id, adminId)).rejects.toBeInstanceOf(
      IncompleteStockTakeError
    )

    await db.destroy()
  })

  it('corrects stock to the counted quantity and logs a stock_take movement for variances', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Variance Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 10,
      userId: adminId
    })
    const unchangedBook = await createBook(db, {
      title: 'Unchanged Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 6,
      userId: adminId
    })

    const stockTake = await startStockTake(db, adminId)
    const items = await listStockTakeItems(db, stockTake.id)
    const varianceItem = items.find((i) => i.book_id === book.id)!
    const unchangedItem = items.find((i) => i.book_id === unchangedBook.id)!

    await recordCount(db, varianceItem.id, 7) // physically counted 7, expected 10
    await recordCount(db, unchangedItem.id, 6) // matches expected

    await completeStockTake(db, stockTake.id, adminId)

    const storedBook = await db
      .selectFrom('books')
      .selectAll()
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(storedBook.stock_qty).toBe(7)

    const movements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('book_id', '=', book.id)
      .where('movement_type', '=', 'stock_take')
      .execute()
    expect(movements).toHaveLength(1)
    expect(movements[0].change_qty).toBe(-3)

    // no stock_take movement for the book whose count matched expectations
    const unchangedMovements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('book_id', '=', unchangedBook.id)
      .where('movement_type', '=', 'stock_take')
      .execute()
    expect(unchangedMovements).toHaveLength(0)

    await db.destroy()
  })
})
