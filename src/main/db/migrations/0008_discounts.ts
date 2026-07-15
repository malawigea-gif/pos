import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('discounts')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('value', 'real', (c) => c.notNull())
    .addColumn('scope', 'text', (c) => c.notNull())
    .addColumn('book_id', 'integer', (c) => c.references('books.id'))
    .addColumn('category_id', 'integer', (c) => c.references('categories.id'))
    .addColumn('starts_at', 'text')
    .addColumn('ends_at', 'text')
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint('discounts_type_check', sql`type IN ('percent', 'fixed')`)
    .addCheckConstraint('discounts_scope_check', sql`scope IN ('item', 'category', 'all')`)
    .execute()
  await db.schema.createIndex('discounts_book_idx').on('discounts').column('book_id').execute()
  await db.schema
    .createIndex('discounts_category_idx')
    .on('discounts')
    .column('category_id')
    .execute()

  await db.schema
    .createTable('combo_offers')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('buy_quantity', 'integer', (c) => c.notNull())
    .addColumn('free_quantity', 'integer', (c) => c.notNull())
    .addColumn('scope', 'text', (c) => c.notNull())
    .addColumn('book_id', 'integer', (c) => c.references('books.id'))
    .addColumn('category_id', 'integer', (c) => c.references('categories.id'))
    .addColumn('starts_at', 'text')
    .addColumn('ends_at', 'text')
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint('combo_offers_scope_check', sql`scope IN ('item', 'category')`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('combo_offers').execute()
  await db.schema.dropTable('discounts').execute()
}
