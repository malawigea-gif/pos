import type { Kysely } from 'kysely'
import type { Database, DiscountScope, DiscountType } from '../types'
import { recordAudit } from '../audit'

export function listDiscounts(db: Kysely<Database>) {
  return db.selectFrom('discounts').selectAll().orderBy('name').execute()
}

export interface DiscountFormInput {
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  bookId?: number | null
  categoryId?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface CreateDiscountInput extends DiscountFormInput {
  userId: number | null
}

export async function createDiscount(db: Kysely<Database>, input: CreateDiscountInput) {
  const discount = await db
    .insertInto('discounts')
    .values({
      name: input.name,
      type: input.type,
      value: input.value,
      scope: input.scope,
      book_id: input.scope === 'item' ? (input.bookId ?? null) : null,
      category_id: input.scope === 'category' ? (input.categoryId ?? null) : null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      is_active: 1
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordAudit(db, {
    userId: input.userId,
    action: 'create',
    entityType: 'discounts',
    entityId: discount.id,
    after: { name: discount.name, type: discount.type, value: discount.value, scope: discount.scope }
  })

  return discount
}

export interface UpdateDiscountInput extends DiscountFormInput {
  userId: number | null
}

export async function updateDiscount(db: Kysely<Database>, id: number, input: UpdateDiscountInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('discounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('discounts')
      .set({
        name: input.name,
        type: input.type,
        value: input.value,
        scope: input.scope,
        book_id: input.scope === 'item' ? (input.bookId ?? null) : null,
        category_id: input.scope === 'category' ? (input.categoryId ?? null) : null,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'discounts',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export async function setDiscountActive(
  db: Kysely<Database>,
  id: number,
  isActive: boolean,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('discounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('discounts')
      .set({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'discounts',
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: after.is_active }
    })

    return after
  })
}
