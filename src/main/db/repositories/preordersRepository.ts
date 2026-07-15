import type { Kysely } from 'kysely'
import type { Database, PreorderStatus } from '../types'
import { recordAudit } from '../audit'

export interface CreatePreorderInput {
  customerId: number
  title: string
  isbn?: string
  bookId?: number
  quantity?: number
  notes?: string
  userId: number | null
}

export async function createPreorder(db: Kysely<Database>, input: CreatePreorderInput) {
  const preorder = await db
    .insertInto('preorders')
    .values({
      customer_id: input.customerId,
      book_id: input.bookId ?? null,
      title: input.title,
      isbn: input.isbn ?? null,
      quantity: input.quantity ?? 1,
      status: 'pending',
      notes: input.notes ?? null
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordAudit(db, {
    userId: input.userId,
    action: 'create',
    entityType: 'preorders',
    entityId: preorder.id,
    after: { title: preorder.title, customer_id: preorder.customer_id }
  })

  return preorder
}

export interface ListPreordersOptions {
  status?: PreorderStatus
  customerId?: number
}

export function listPreorders(db: Kysely<Database>, options: ListPreordersOptions = {}) {
  let query = db
    .selectFrom('preorders')
    .innerJoin('customers', 'customers.id', 'preorders.customer_id')
    .select([
      'preorders.id',
      'preorders.customer_id',
      'preorders.book_id',
      'preorders.title',
      'preorders.isbn',
      'preorders.quantity',
      'preorders.status',
      'preorders.notes',
      'preorders.created_at',
      'customers.name as customer_name'
    ])
  if (options.status !== undefined) query = query.where('preorders.status', '=', options.status)
  if (options.customerId !== undefined) query = query.where('preorders.customer_id', '=', options.customerId)
  return query.orderBy('preorders.created_at', 'desc').execute()
}

export async function updatePreorderStatus(
  db: Kysely<Database>,
  id: number,
  status: PreorderStatus,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('preorders')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('preorders')
      .set({ status, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'preorders',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status }
    })

    return after
  })
}
