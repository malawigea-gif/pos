import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('quotations')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('quote_no', 'text', (c) => c.notNull().unique())
    .addColumn('customer_id', 'integer', (c) => c.references('customers.id'))
    .addColumn('created_by', 'integer', (c) => c.notNull().references('users.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('open'))
    .addColumn('subtotal', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('discount_total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('tax_total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('valid_until', 'text')
    .addColumn('notes', 'text')
    .addColumn('quote_date', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      'quotations_status_check',
      sql`status IN ('open', 'converted', 'expired', 'cancelled')`
    )
    .execute()
  await db.schema.createIndex('quotations_customer_idx').on('quotations').column('customer_id').execute()
  await db.schema.createIndex('quotations_created_by_idx').on('quotations').column('created_by').execute()
  await db.schema.createIndex('quotations_date_idx').on('quotations').column('quote_date').execute()

  await db.schema
    .createTable('quotation_items')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('quotation_id', 'integer', (c) => c.notNull().references('quotations.id').onDelete('cascade'))
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_price', 'real', (c) => c.notNull())
    .addColumn('discount_amount', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('tax_amount', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('line_total', 'real', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('quotation_items_quotation_idx')
    .on('quotation_items')
    .column('quotation_id')
    .execute()
  await db.schema.createIndex('quotation_items_book_idx').on('quotation_items').column('book_id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('quotation_items').execute()
  await db.schema.dropTable('quotations').execute()
}
