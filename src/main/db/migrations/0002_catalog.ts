import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('categories')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull().unique())
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('tax_rates')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('rate_percent', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('is_exempt', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_default', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('suppliers')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('contact_person', 'text')
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('address', 'text')
    .addColumn('balance', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
  await db.schema.createIndex('suppliers_name_idx').on('suppliers').column('name').execute()

  await db.schema
    .createTable('books')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('isbn', 'text', (c) => c.unique())
    .addColumn('barcode', 'text', (c) => c.unique())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('author', 'text')
    .addColumn('publisher', 'text')
    .addColumn('category_id', 'integer', (c) => c.references('categories.id'))
    .addColumn('language', 'text')
    .addColumn('tax_rate_id', 'integer', (c) => c.references('tax_rates.id'))
    .addColumn('cost_price', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('selling_price', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('stock_qty', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('reorder_level', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('shelf_location', 'text')
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
  await db.schema.createIndex('books_isbn_idx').on('books').column('isbn').execute()
  await db.schema.createIndex('books_barcode_idx').on('books').column('barcode').execute()
  await db.schema.createIndex('books_title_idx').on('books').column('title').execute()
  await db.schema.createIndex('books_author_idx').on('books').column('author').execute()
  await db.schema.createIndex('books_category_idx').on('books').column('category_id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('books').execute()
  await db.schema.dropTable('suppliers').execute()
  await db.schema.dropTable('tax_rates').execute()
  await db.schema.dropTable('categories').execute()
}
