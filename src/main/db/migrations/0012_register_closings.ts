import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('register_closings')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('business_date', 'text', (c) => c.notNull())
    .addColumn('opening_float', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('cash_sales_total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('non_cash_sales_total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('counted_cash', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('variance', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('closed_by', 'integer', (c) => c.references('users.id'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
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
