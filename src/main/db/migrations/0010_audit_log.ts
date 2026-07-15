import { sql, type Kysely } from 'kysely'
import { addIdColumn, currentTimestampDefault } from './dialectHelpers'

export async function up(db: Kysely<unknown>): Promise<void> {
  await addIdColumn(db.schema.createTable('audit_log'), db)
    .addColumn('user_id', 'integer', (c) => c.references('users.id'))
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('entity_type', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'integer', (c) => c.notNull())
    .addColumn('changes', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull().defaultTo(currentTimestampDefault(db)))
    .addCheckConstraint('audit_log_action_check', sql`action IN ('create', 'update', 'delete')`)
    .execute()
  await db.schema.createIndex('audit_log_user_idx').on('audit_log').column('user_id').execute()
  await db.schema
    .createIndex('audit_log_entity_idx')
    .on('audit_log')
    .columns(['entity_type', 'entity_id'])
    .execute()
  await db.schema
    .createIndex('audit_log_created_idx')
    .on('audit_log')
    .column('created_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('audit_log').execute()
}
