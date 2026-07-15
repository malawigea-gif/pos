import { sql, type Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('sales'), db)
    .addColumn('invoice_no', 'text', (c) => c.notNull().unique())
    .addColumn('customer_id', 'integer', (c) => c.references('customers.id'))
    .addColumn('cashier_id', 'integer', (c) => c.notNull().references('users.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('completed'))
    .addColumn('subtotal', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('discount_total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('tax_total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('amount_paid', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('notes', 'text')
    .addColumn('sale_date', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint(
      'sales_status_check',
      sql`status IN ('held', 'completed', 'voided', 'returned', 'partially_returned')`
    )
    .execute()
  await db.schema.createIndex('sales_customer_idx').on('sales').column('customer_id').execute()
  await db.schema.createIndex('sales_cashier_idx').on('sales').column('cashier_id').execute()
  await db.schema.createIndex('sales_date_idx').on('sales').column('sale_date').execute()

  await addIdColumn(db.schema.createTable('sale_items'), db)
    .addColumn('sale_id', 'integer', (c) => c.notNull().references('sales.id').onDelete('cascade'))
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_price', 'double precision', (c) => c.notNull())
    .addColumn('discount_amount', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('tax_amount', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('line_total', 'double precision', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('sale_items_sale_idx').on('sale_items').column('sale_id').execute()
  await db.schema.createIndex('sale_items_book_idx').on('sale_items').column('book_id').execute()

  await addIdColumn(db.schema.createTable('sale_payments'), db)
    .addColumn('sale_id', 'integer', (c) => c.notNull().references('sales.id').onDelete('cascade'))
    .addColumn('method', 'text', (c) => c.notNull())
    .addColumn('amount', 'double precision', (c) => c.notNull())
    .addColumn('reference', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint(
      'sale_payments_method_check',
      sql`method IN ('cash', 'card', 'mobile_wallet', 'credit', 'other')`
    )
    .execute()
  await db.schema.createIndex('sale_payments_sale_idx').on('sale_payments').column('sale_id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sale_payments').execute()
  await db.schema.dropTable('sale_items').execute()
  await db.schema.dropTable('sales').execute()
}
