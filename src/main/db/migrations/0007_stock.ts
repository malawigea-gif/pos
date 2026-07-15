import { sql, type Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('stock_movements'), db)
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('change_qty', 'integer', (c) => c.notNull())
    .addColumn('movement_type', 'text', (c) => c.notNull())
    .addColumn('reference_type', 'text')
    .addColumn('reference_id', 'integer')
    .addColumn('notes', 'text')
    .addColumn('created_by', 'integer', (c) => c.references('users.id'))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint(
      'stock_movements_type_check',
      sql`movement_type IN ('sale', 'return', 'grn', 'adjustment', 'write_off', 'stock_take')`
    )
    .execute()
  await db.schema
    .createIndex('stock_movements_book_idx')
    .on('stock_movements')
    .column('book_id')
    .execute()
  await db.schema
    .createIndex('stock_movements_created_idx')
    .on('stock_movements')
    .column('created_at')
    .execute()
  await db.schema
    .createIndex('stock_movements_reference_idx')
    .on('stock_movements')
    .columns(['reference_type', 'reference_id'])
    .execute()

  await addIdColumn(db.schema.createTable('stock_takes'), db)
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('in_progress'))
    .addColumn('started_by', 'integer', (c) => c.references('users.id'))
    .addColumn('completed_by', 'integer', (c) => c.references('users.id'))
    .addColumn('started_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('completed_at', 'text')
    .addColumn('notes', 'text')
    .addCheckConstraint(
      'stock_takes_status_check',
      sql`status IN ('in_progress', 'completed', 'cancelled')`
    )
    .execute()

  await addIdColumn(db.schema.createTable('stock_take_items'), db)
    .addColumn('stock_take_id', 'integer', (c) =>
      c.notNull().references('stock_takes.id').onDelete('cascade')
    )
    .addColumn('book_id', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('expected_qty', 'integer', (c) => c.notNull())
    .addColumn('counted_qty', 'integer')
    .addColumn('notes', 'text')
    .execute()
  await db.schema
    .createIndex('stock_take_items_take_idx')
    .on('stock_take_items')
    .column('stock_take_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('stock_take_items').execute()
  await db.schema.dropTable('stock_takes').execute()
  await db.schema.dropTable('stock_movements').execute()
}
