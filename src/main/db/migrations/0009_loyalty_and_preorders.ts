import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('loyalty_transactions')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('customer_id', 'integer', (c) => c.notNull().references('customers.id'))
    .addColumn('sale_id', 'integer', (c) => c.references('sales.id'))
    .addColumn('points_change', 'integer', (c) => c.notNull())
    .addColumn('reason', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
  await db.schema
    .createIndex('loyalty_transactions_customer_idx')
    .on('loyalty_transactions')
    .column('customer_id')
    .execute()

  await db.schema
    .createTable('preorders')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('customer_id', 'integer', (c) => c.notNull().references('customers.id'))
    .addColumn('book_id', 'integer', (c) => c.references('books.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('isbn', 'text')
    .addColumn('quantity', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('pending'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      'preorders_status_check',
      sql`status IN ('pending', 'notified', 'fulfilled', 'cancelled')`
    )
    .execute()
  await db.schema.createIndex('preorders_customer_idx').on('preorders').column('customer_id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('preorders').execute()
  await db.schema.dropTable('loyalty_transactions').execute()
}
