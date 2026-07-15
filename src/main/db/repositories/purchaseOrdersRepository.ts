import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import type { Database, PurchaseOrderStatus } from '../types'
import { recordAudit } from '../audit'

export function formatPoNo(id: number, date: Date): string {
  return `PO-${date.getFullYear()}-${String(id).padStart(6, '0')}`
}

export interface PurchaseOrderItemInput {
  bookId: number
  quantity: number
  unitCost: number
}

export interface CreatePurchaseOrderInput {
  supplierId: number
  items: PurchaseOrderItemInput[]
  expectedDate?: string
  notes?: string
  userId: number | null
}

export async function createPurchaseOrder(db: Kysely<Database>, input: CreatePurchaseOrderInput) {
  return db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('purchase_orders')
      .values({
        po_no: `PENDING-${randomUUID()}`,
        supplier_id: input.supplierId,
        status: 'sent',
        expected_date: input.expectedDate ?? null,
        notes: input.notes ?? null,
        created_by: input.userId
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('purchase_order_items')
      .values(
        input.items.map((item) => ({
          purchase_order_id: inserted.id,
          book_id: item.bookId,
          quantity: item.quantity,
          unit_cost: item.unitCost
        }))
      )
      .execute()

    const poNo = formatPoNo(inserted.id, new Date())
    const po = await trx
      .updateTable('purchase_orders')
      .set({ po_no: poNo })
      .where('id', '=', inserted.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'purchase_orders',
      entityId: po.id,
      after: { po_no: po.po_no, supplier_id: po.supplier_id }
    })

    return po
  })
}

export interface ListPurchaseOrdersOptions {
  supplierId?: number
  status?: PurchaseOrderStatus
}

export function listPurchaseOrders(db: Kysely<Database>, options: ListPurchaseOrdersOptions = {}) {
  let query = db.selectFrom('purchase_orders').selectAll()
  if (options.supplierId !== undefined) query = query.where('supplier_id', '=', options.supplierId)
  if (options.status !== undefined) query = query.where('status', '=', options.status)
  return query.orderBy('order_date', 'desc').execute()
}

export async function getPurchaseOrderWithItems(db: Kysely<Database>, id: number) {
  const po = await db.selectFrom('purchase_orders').selectAll().where('id', '=', id).executeTakeFirst()
  if (!po) return undefined

  const items = await db
    .selectFrom('purchase_order_items')
    .innerJoin('books', 'books.id', 'purchase_order_items.book_id')
    .select([
      'purchase_order_items.id',
      'purchase_order_items.purchase_order_id',
      'purchase_order_items.book_id',
      'purchase_order_items.quantity',
      'purchase_order_items.unit_cost',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
    .where('purchase_order_items.purchase_order_id', '=', id)
    .execute()

  return { po, items }
}

export async function updatePurchaseOrderStatus(
  db: Kysely<Database>,
  id: number,
  status: PurchaseOrderStatus,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('purchase_orders')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('purchase_orders')
      .set({ status, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'purchase_orders',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status }
    })

    return after
  })
}
