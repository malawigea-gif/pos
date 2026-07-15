import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('returns')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('return_no', 'text', (c) => c.notNull().unique())
    .addColumn('sale_id', 'integer', (c) => c.notNull().references('sales.id'))
    .addColumn('processed_by', 'integer', (c) => c.notNull().references('users.id'))
    .addColumn('approved_by', 'integer', (c) => c.references('users.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('completed'))
    .addColumn('reason', 'text')
    .addColumn('refund_total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('refund_method', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      'returns_status_check',
      sql`status IN ('pending_approval', 'approved', 'rejected', 'completed')`
    )
    .execute()
  await db.schema.createIndex('returns_sale_idx').on('returns').column('sale_id').execute()

  await db.schema
    .createTable('return_items')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('return_id', 'integer', (c) => c.notNull().references('returns.id').onDelete('cascade'))
    .addColumn('sale_item_id', 'integer', (c) => c.notNull().references('sale_items.id'))
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('refund_amount', 'real', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('return_items_return_idx')
    .on('return_items')
    .column('return_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('return_items').execute()
  await db.schema.dropTable('returns').execute()
}
