import type { Kysely, Transaction } from 'kysely'
import type { Database, StockMovementType } from '../types'
import { recordAudit } from '../audit'

export interface AdjustStockInput {
  bookId: number
  changeQty: number
  movementType: StockMovementType
  referenceType?: string | null
  referenceId?: number | null
  userId: number | null
  notes?: string | null
  /** Manual corrections (adjustment/write-off/stock-take) may need to push
   *  stock below zero to fix a bad prior count; sales/returns never should. */
  allowNegative?: boolean
}

export class InsufficientStockError extends Error {
  constructor(public readonly bookId: number) {
    super(`Insufficient stock for book ${bookId}`)
    this.name = 'InsufficientStockError'
  }
}

/** Core logic, reusable by callers that already hold an open transaction
 *  (e.g. book creation, which must insert the book row and its initial-stock
 *  movement atomically). SQLite/better-sqlite3 doesn't support nested
 *  BEGINs, so this must not open its own transaction when one is already
 *  active on the connection. */
export async function adjustStockWithTrx(
  trx: Transaction<Database>,
  input: AdjustStockInput
): Promise<void> {
  const book = await trx
    .selectFrom('books')
    .select(['id', 'stock_qty'])
    .where('id', '=', input.bookId)
    .executeTakeFirstOrThrow()

  const newQty = book.stock_qty + input.changeQty
  if (newQty < 0 && !input.allowNegative) {
    throw new InsufficientStockError(input.bookId)
  }

  await trx
    .updateTable('books')
    .set({ stock_qty: newQty, updated_at: new Date().toISOString() })
    .where('id', '=', input.bookId)
    .execute()

  await trx
    .insertInto('stock_movements')
    .values({
      book_id: input.bookId,
      change_qty: input.changeQty,
      movement_type: input.movementType,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      notes: input.notes ?? null,
      created_by: input.userId
    })
    .execute()

  await recordAudit(trx, {
    userId: input.userId,
    action: 'update',
    entityType: 'books',
    entityId: input.bookId,
    before: { stock_qty: book.stock_qty },
    after: { stock_qty: newQty }
  })
}

export async function adjustStock(db: Kysely<Database>, input: AdjustStockInput): Promise<void> {
  await db.transaction().execute((trx) => adjustStockWithTrx(trx, input))
}

export function getMovementHistory(db: Kysely<Database>, bookId: number) {
  return db
    .selectFrom('stock_movements')
    .selectAll()
    .where('book_id', '=', bookId)
    // created_at has only second-level resolution in SQLite, so id (which is
    // strictly insertion-ordered) is needed to break ties reliably.
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .execute()
}
