import { sql, type Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('users'), db)
    .addColumn('username', 'text', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull().defaultTo('si'))
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint('users_role_check', sql`role IN ('admin', 'manager', 'cashier')`)
    .addCheckConstraint('users_language_check', sql`language IN ('en', 'si')`)
    .execute()

  await addIdColumn(db.schema.createTable('settings'), db)
    .addColumn('key', 'text', (c) => c.notNull().unique())
    .addColumn('value', 'text', (c) => c.notNull())
    .addColumn('updated_by', 'integer', (c) => c.references('users.id'))
    .addColumn('updated_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('settings').execute()
  await db.schema.dropTable('users').execute()
}
