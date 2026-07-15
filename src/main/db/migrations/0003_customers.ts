import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('customers')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('address', 'text')
    .addColumn('loyalty_points', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_credit_account', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('credit_limit', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('credit_balance', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
  await db.schema.createIndex('customers_name_idx').on('customers').column('name').execute()
  await db.schema.createIndex('customers_phone_idx').on('customers').column('phone').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('customers').execute()
}
