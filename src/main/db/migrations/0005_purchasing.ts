import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('purchase_orders')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('po_no', 'text', (c) => c.notNull().unique())
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('draft'))
    .addColumn('order_date', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('expected_date', 'text')
    .addColumn('notes', 'text')
    .addColumn('created_by', 'integer', (c) => c.references('users.id'))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
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

  await db.schema
    .createTable('purchase_order_items')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('purchase_order_id', 'integer', (c) =>
      c.notNull().references('purchase_orders.id').onDelete('cascade')
    )
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_cost', 'real', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('po_items_po_idx')
    .on('purchase_order_items')
    .column('purchase_order_id')
    .execute()

  await db.schema
    .createTable('goods_received_notes')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('grn_no', 'text', (c) => c.notNull().unique())
    .addColumn('purchase_order_id', 'integer', (c) => c.references('purchase_orders.id'))
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('received_date', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('total', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('received_by', 'integer', (c) => c.references('users.id'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
  await db.schema
    .createIndex('grn_supplier_idx')
    .on('goods_received_notes')
    .column('supplier_id')
    .execute()

  await db.schema
    .createTable('grn_items')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('grn_id', 'integer', (c) =>
      c.notNull().references('goods_received_notes.id').onDelete('cascade')
    )
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_cost', 'real', (c) => c.notNull())
    .addColumn('line_total', 'real', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('grn_items_grn_idx').on('grn_items').column('grn_id').execute()

  await db.schema
    .createTable('supplier_payments')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('supplier_id', 'integer', (c) => c.notNull().references('suppliers.id'))
    .addColumn('amount', 'real', (c) => c.notNull())
    .addColumn('method', 'text')
    .addColumn('reference', 'text')
    .addColumn('due_date', 'text')
    .addColumn('paid_date', 'text')
    .addColumn('created_by', 'integer', (c) => c.references('users.id'))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
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
