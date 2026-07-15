import type { Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('register_closings'), db)
    .addColumn('business_date', 'text', (c) => c.notNull())
    .addColumn('opening_float', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('cash_sales_total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('non_cash_sales_total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('counted_cash', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('variance', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('closed_by', 'integer', (c) => c.references('users.id'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .execute()
  await db.schema
    .createIndex('register_closings_date_idx')
    .on('register_closings')
    .column('business_date')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('register_closings').execute()
}
