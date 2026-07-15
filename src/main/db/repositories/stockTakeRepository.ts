import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'
import { adjustStockWithTrx } from './stockRepository'

export class IncompleteStockTakeError extends Error {
  constructor(public readonly missingCount: number) {
    super(`${missingCount} item(s) still need a counted quantity before this stock take can complete`)
    this.name = 'IncompleteStockTakeError'
  }
}

export async function startStockTake(
  db: Kysely<Database>,
  userId: number | null,
  categoryId?: number
) {
  return db.transaction().execute(async (trx) => {
    const stockTake = await trx
      .insertInto('stock_takes')
      .values({
        status: 'in_progress',
        started_by: userId,
        completed_by: null,
        completed_at: null,
        notes: null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    let booksQuery = trx.selectFrom('books').select(['id', 'stock_qty']).where('is_active', '=', 1)
    if (categoryId !== undefined) {
      booksQuery = booksQuery.where('category_id', '=', categoryId)
    }
    const books = await booksQuery.execute()

    if (books.length > 0) {
      await trx
        .insertInto('stock_take_items')
        .values(
          books.map((book) => ({
            stock_take_id: stockTake.id,
            book_id: book.id,
            expected_qty: book.stock_qty,
            counted_qty: null,
            notes: null
          }))
        )
        .execute()
    }

    return stockTake
  })
}

export function getStockTake(db: Kysely<Database>, id: number) {
  return db.selectFrom('stock_takes').selectAll().where('id', '=', id).executeTakeFirst()
}

export function listStockTakeItems(db: Kysely<Database>, stockTakeId: number) {
  return db
    .selectFrom('stock_take_items')
    .innerJoin('books', 'books.id', 'stock_take_items.book_id')
    .select([
      'stock_take_items.id',
      'stock_take_items.stock_take_id',
      'stock_take_items.book_id',
      'stock_take_items.expected_qty',
      'stock_take_items.counted_qty',
      'stock_take_items.notes',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
    .where('stock_take_items.stock_take_id', '=', stockTakeId)
    .orderBy('books.title')
    .execute()
}

export function getLatestInProgressStockTake(db: Kysely<Database>) {
  return db
    .selectFrom('stock_takes')
    .selectAll()
    .where('status', '=', 'in_progress')
    .orderBy('started_at', 'desc')
    .executeTakeFirst()
}

export function recordCount(db: Kysely<Database>, stockTakeItemId: number, countedQty: number) {
  return db
    .updateTable('stock_take_items')
    .set({ counted_qty: countedQty })
    .where('id', '=', stockTakeItemId)
    .execute()
}

export async function completeStockTake(
  db: Kysely<Database>,
  stockTakeId: number,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const items = await trx
      .selectFrom('stock_take_items')
      .selectAll()
      .where('stock_take_id', '=', stockTakeId)
      .execute()

    const uncounted = items.filter((item) => item.counted_qty === null)
    if (uncounted.length > 0) {
      throw new IncompleteStockTakeError(uncounted.length)
    }

    for (const item of items) {
      const variance = (item.counted_qty as number) - item.expected_qty
      if (variance !== 0) {
        await adjustStockWithTrx(trx, {
          bookId: item.book_id,
          changeQty: variance,
          movementType: 'stock_take',
          referenceType: 'stock_take',
          referenceId: stockTakeId,
          userId,
          notes: 'Stock take variance correction',
          allowNegative: true
        })
      }
    }

    const completed = await trx
      .updateTable('stock_takes')
      .set({
        status: 'completed',
        completed_by: userId,
        completed_at: new Date().toISOString()
      })
      .where('id', '=', stockTakeId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'stock_takes',
      entityId: stockTakeId,
      after: { status: 'completed', variances: items.filter((i) => (i.counted_qty as number) - i.expected_qty !== 0).length }
    })

    return completed
  })
}
