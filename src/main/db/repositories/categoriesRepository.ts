import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'

export function listCategories(db: Kysely<Database>) {
  return db.selectFrom('categories').selectAll().orderBy('name').execute()
}

export interface CreateCategoryInput {
  name: string
  defaultReorderLevel?: number
  userId: number | null
}

export async function createCategory(db: Kysely<Database>, input: CreateCategoryInput) {
  const category = await db
    .insertInto('categories')
    .values({
      name: input.name,
      default_reorder_level: input.defaultReorderLevel ?? 0
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordAudit(db, {
    userId: input.userId,
    action: 'create',
    entityType: 'categories',
    entityId: category.id,
    after: { name: category.name, default_reorder_level: category.default_reorder_level }
  })

  return category
}

/** Looks up a category by exact name, creating it if it doesn't exist yet —
 *  used by the book form's "select or create" category combo. */
export async function findOrCreateCategoryByName(
  db: Kysely<Database>,
  name: string,
  userId: number | null
) {
  const existing = await db
    .selectFrom('categories')
    .selectAll()
    .where('name', '=', name)
    .executeTakeFirst()
  if (existing) return existing

  return createCategory(db, { name, userId })
}
