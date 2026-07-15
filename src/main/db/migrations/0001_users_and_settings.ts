import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('username', 'text', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull().defaultTo('si'))
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint('users_role_check', sql`role IN ('admin', 'manager', 'cashier')`)
    .addCheckConstraint('users_language_check', sql`language IN ('en', 'si')`)
    .execute()

  await db.schema
    .createTable('settings')
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('key', 'text', (c) => c.notNull().unique())
    .addColumn('value', 'text', (c) => c.notNull())
    .addColumn('updated_by', 'integer', (c) => c.references('users.id'))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('settings').execute()
  await db.schema.dropTable('users').execute()
}
