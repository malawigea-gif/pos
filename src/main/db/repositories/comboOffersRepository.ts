import type { Kysely } from 'kysely'
import type { ComboScope, Database } from '../types'
import { recordAudit } from '../audit'

export function listComboOffers(db: Kysely<Database>) {
  return db.selectFrom('combo_offers').selectAll().orderBy('name').execute()
}

export interface ComboOfferFormInput {
  name: string
  buyQuantity: number
  freeQuantity: number
  scope: ComboScope
  bookId?: number | null
  categoryId?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface CreateComboOfferInput extends ComboOfferFormInput {
  userId: number | null
}

export async function createComboOffer(db: Kysely<Database>, input: CreateComboOfferInput) {
  const combo = await db
    .insertInto('combo_offers')
    .values({
      name: input.name,
      buy_quantity: input.buyQuantity,
      free_quantity: input.freeQuantity,
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
    entityType: 'combo_offers',
    entityId: combo.id,
    after: { name: combo.name, buy_quantity: combo.buy_quantity, free_quantity: combo.free_quantity }
  })

  return combo
}

export interface UpdateComboOfferInput extends ComboOfferFormInput {
  userId: number | null
}

export async function updateComboOffer(db: Kysely<Database>, id: number, input: UpdateComboOfferInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('combo_offers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('combo_offers')
      .set({
        name: input.name,
        buy_quantity: input.buyQuantity,
        free_quantity: input.freeQuantity,
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
      entityType: 'combo_offers',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export async function setComboOfferActive(
  db: Kysely<Database>,
  id: number,
  isActive: boolean,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('combo_offers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('combo_offers')
      .set({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'combo_offers',
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: after.is_active }
    })

    return after
  })
}
