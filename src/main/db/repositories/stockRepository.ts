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
/** Under a single-till SQLite install this read-then-write never raced,
 *  because SQLite serializes all writers. Under a multi-till Postgres
 *  server, two tills selling the last unit of the same book concurrently
 *  could both read stock_qty=1, both compute newQty=0, and both succeed —
 *  overselling by one unit. Fixed as a single guarded atomic UPDATE: the
 *  WHERE clause re-checks stock_qty at the moment of the write (under the
 *  row lock the UPDATE itself takes), not from a possibly-stale read, so a
 *  concurrent decrement below zero can never both "succeed". */
export async function adjustStockWithTrx(
  trx: Transaction<Database>,
  input: AdjustStockInput
): Promise<void> {
  let query = trx
    .updateTable('books')
    .set((eb) => ({
      stock_qty: eb('stock_qty', '+', input.changeQty),
      updated_at: new Date().toISOString()
    }))
    .where('id', '=', input.bookId)

  if (!input.allowNegative) {
    query = query.where('stock_qty', '>=', -input.changeQty)
  }

  const updated = await query.returning(['stock_qty']).executeTakeFirst()
  if (!updated) {
    // The guard above failed — current stock can't cover this deduction.
    // (A nonexistent bookId would also land here, but every caller already
    // works from a bookId it just read from this same table.)
    throw new InsufficientStockError(input.bookId)
  }

  const afterQty = updated.stock_qty
  const beforeQty = afterQty - input.changeQty

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
    before: { stock_qty: beforeQty },
    after: { stock_qty: afterQty }
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
