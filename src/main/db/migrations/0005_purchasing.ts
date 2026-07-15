import { sql, type Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('purchase_orders'), db)
    .addColumn('po_no', 'text', (c) => c.notNull().unique())
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('draft'))
    .addColumn('order_date', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('expected_date', 'text')
    .addColumn('notes', 'text')
    .addColumn('created_by', 'integer', (c) => c.references('users.id'))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint(
      'po_status_check',
      sql`status IN ('draft', 'sent', 'partially_received', 'received', 'cancelled')`
    )
    .execute()
  await db.schema
    .createIndex('purchase_orders_supplier_idx')
    .on('purchase_orders')
    .column('supplier_id')
    .execute()

  await addIdColumn(db.schema.createTable('purchase_order_items'), db)
    .addColumn('purchase_order_id', 'integer', (c) =>
      c.notNull().references('purchase_orders.id').onDelete('cascade')
    )
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_cost', 'double precision', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('po_items_po_idx')
    .on('purchase_order_items')
    .column('purchase_order_id')
    .execute()

  await addIdColumn(db.schema.createTable('goods_received_notes'), db)
    .addColumn('grn_no', 'text', (c) => c.notNull().unique())
    .addColumn('purchase_order_id', 'integer', (c) => c.references('purchase_orders.id'))
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('received_date', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('total', 'double precision', (c) => c.notNull().defaultTo(0))
    .addColumn('received_by', 'integer', (c) => c.references('users.id'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .execute()
  await db.schema
    .createIndex('grn_supplier_idx')
    .on('goods_received_notes')
    .column('supplier_id')
    .execute()

  await addIdColumn(db.schema.createTable('grn_items'), db)
    .addColumn('grn_id', 'integer', (c) =>
      c.notNull().references('goods_received_notes.id').onDelete('cascade')
    )
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_cost', 'double precision', (c) => c.notNull())
    .addColumn('line_total', 'double precision', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('grn_items_grn_idx').on('grn_items').column('grn_id').execute()

  await addIdColumn(db.schema.createTable('supplier_payments'), db)
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('amount', 'double precision', (c) => c.notNull())
    .addColumn('method', 'text')
    .addColumn('reference', 'text')
    .addColumn('due_date', 'text')
    .addColumn('paid_date', 'text')
    .addColumn('created_by', 'integer', (c) => c.references('users.id'))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .execute()
  await db.schema
    .createIndex('supplier_payments_supplier_idx')
    .on('supplier_payments')
    .column('supplier_id')
    .execute()
  await db.schema
    .createIndex('supplier_payments_due_idx')
    .on('supplier_payments')
    .column('due_date')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('supplier_payments').execute()
  await db.schema.dropTable('grn_items').execute()
  await db.schema.dropTable('goods_received_notes').execute()
  await db.schema.dropTable('purchase_order_items').execute()
  await db.schema.dropTable('purchase_orders').execute()
}
