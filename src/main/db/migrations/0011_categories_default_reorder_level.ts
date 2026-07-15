import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('categories')
    .addColumn('default_reorder_level', 'integer', (c) => c.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('categories').dropColumn('default_reorder_level').execute()
}
