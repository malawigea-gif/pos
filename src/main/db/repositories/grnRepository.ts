import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'
import { adjustStockWithTrx } from './stockRepository'

export function formatGrnNo(id: number, date: Date): string {
  return `GRN-${date.getFullYear()}-${String(id).padStart(6, '0')}`
}

export interface GrnItemInput {
  bookId: number
  quantity: number
  unitCost: number
}

export interface CreateGrnInput {
  supplierId: number
  purchaseOrderId?: number
  items: GrnItemInput[]
  notes?: string
  userId: number | null
}

/** Receiving goods: adds stock for every item, raises the supplier's
 *  running balance by the GRN total (money now owed to them), and — if
 *  this GRN fulfills a purchase order — marks that order received. All in
 *  one transaction, so a partial receive can never leave stock updated
 *  without the matching balance/PO bookkeeping (or vice versa). */
export async function createGrn(db: Kysely<Database>, input: CreateGrnInput) {
  return db.transaction().execute(async (trx) => {
    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)

    const inserted = await trx
      .insertInto('goods_received_notes')
      .values({
        grn_no: `PENDING-${randomUUID()}`,
        purchase_order_id: input.purchaseOrderId ?? null,
        supplier_id: input.supplierId,
        total,
        received_by: input.userId,
        notes: input.notes ?? null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('grn_items')
      .values(
        input.items.map((item) => ({
          grn_id: inserted.id,
          book_id: item.bookId,
          quantity: item.quantity,
          unit_cost: item.unitCost,
          line_total: item.quantity * item.unitCost
        }))
      )
      .execute()

    const grnNo = formatGrnNo(inserted.id, new Date())
    const grn = await trx
      .updateTable('goods_received_notes')
      .set({ grn_no: grnNo })
      .where('id', '=', inserted.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    for (const item of input.items) {
      await adjustStockWithTrx(trx, {
        bookId: item.bookId,
        changeQty: item.quantity,
        movementType: 'grn',
        referenceType: 'grn',
        referenceId: grn.id,
        userId: input.userId
      })
    }

    const supplier = await trx
      .selectFrom('suppliers')
      .select(['id', 'balance'])
      .where('id', '=', input.supplierId)
      .executeTakeFirstOrThrow()
    const newBalance = supplier.balance + total
    await trx
      .updateTable('suppliers')
      .set({ balance: newBalance, updated_at: new Date().toISOString() })
      .where('id', '=', input.supplierId)
      .execute()

    if (input.purchaseOrderId !== undefined) {
      await trx
        .updateTable('purchase_orders')
        .set({ status: 'received', updated_at: new Date().toISOString() })
        .where('id', '=', input.purchaseOrderId)
        .execute()
    }

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'goods_received_notes',
      entityId: grn.id,
      after: { grn_no: grn.grn_no, total: grn.total, supplier_id: grn.supplier_id }
    })

    return grn
  })
}

export function listGrns(db: Kysely<Database>, supplierId?: number) {
  let query = db.selectFrom('goods_received_notes').selectAll()
  if (supplierId !== undefined) query = query.where('supplier_id', '=', supplierId)
  return query.orderBy('received_date', 'desc').execute()
}

export async function getGrnWithItems(db: Kysely<Database>, id: number) {
  const grn = await db.selectFrom('goods_received_notes').selectAll().where('id', '=', id).executeTakeFirst()
  if (!grn) return undefined

  const items = await db
    .selectFrom('grn_items')
    .innerJoin('books', 'books.id', 'grn_items.book_id')
    .select([
      'grn_items.id',
      'grn_items.grn_id',
      'grn_items.book_id',
      'grn_items.quantity',
      'grn_items.unit_cost',
      'grn_items.line_total',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
    .where('grn_items.grn_id', '=', id)
    .execute()

  return { grn, items }
}
