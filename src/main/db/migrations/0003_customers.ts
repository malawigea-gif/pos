import type { Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('customers'), db)
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('address', 'text')
    .addColumn('loyalty_points', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_credit_account', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('credit_limit', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('credit_balance', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .execute()
  await db.schema.createIndex('customers_name_idx').on('customers').column('name').execute()
  await db.schema.createIndex('customers_phone_idx').on('customers').column('phone').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('customers').execute()
}
