import { sql, type Kysely } from 'kysely'
import type { Database } from '../types'
import type { AuditLogEntryView, AuditLogFilter, AuditLogPage } from '../../../shared/audit'

const DEFAULT_LIMIT = 50

export async function listAuditLog(db: Kysely<Database>, filter: AuditLogFilter = {}): Promise<AuditLogPage> {
  const limit = filter.limit ?? DEFAULT_LIMIT
  const offset = filter.offset ?? 0

  let rowsQuery = db
    .selectFrom('audit_log')
    .leftJoin('users', 'users.id', 'audit_log.user_id')
    .select([
      'audit_log.id',
      'audit_log.user_id',
      'users.username',
      'users.full_name',
      'audit_log.action',
      'audit_log.entity_type',
      'audit_log.entity_id',
      'audit_log.changes',
      'audit_log.created_at'
    ])

  let countQuery = db.selectFrom('audit_log').select((eb) => eb.fn.countAll().as('count'))

  if (filter.entityType) {
    rowsQuery = rowsQuery.where('audit_log.entity_type', '=', filter.entityType)
    countQuery = countQuery.where('audit_log.entity_type', '=', filter.entityType)
  }
  if (filter.action) {
    rowsQuery = rowsQuery.where('audit_log.action', '=', filter.action)
    countQuery = countQuery.where('audit_log.action', '=', filter.action)
  }
  if (filter.userId !== undefined) {
    rowsQuery = rowsQuery.where('audit_log.user_id', '=', filter.userId)
    countQuery = countQuery.where('audit_log.user_id', '=', filter.userId)
  }
  if (filter.dateRange) {
    // audit_log.created_at is populated by SQLite's CURRENT_TIMESTAMP
    // ('YYYY-MM-DD HH:MM:SS'), not the app-generated ISO-8601-with-'Z'
    // strings used for filter bounds — a plain string comparison between
    // the two formats sorts incorrectly, so both sides are normalized
    // through datetime() before comparing.
    const { from, to } = filter.dateRange
    rowsQuery = rowsQuery.where(
      sql<boolean>`datetime(audit_log.created_at) between datetime(${from}) and datetime(${to})`
    )
    countQuery = countQuery.where(
      sql<boolean>`datetime(audit_log.created_at) between datetime(${from}) and datetime(${to})`
    )
  }

  const [rows, countResult] = await Promise.all([
    rowsQuery.orderBy('audit_log.created_at', 'desc').orderBy('audit_log.id', 'desc').limit(limit).offset(offset).execute(),
    countQuery.executeTakeFirstOrThrow()
  ])

  const entries: AuditLogEntryView[] = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: row.changes ? JSON.parse(row.changes) : null,
    createdAt: row.created_at
  }))

  return { entries, total: Number(countResult.count) }
}

export async function listAuditEntityTypes(db: Kysely<Database>): Promise<string[]> {
  const rows = await db
    .selectFrom('audit_log')
    .select('entity_type')
    .distinct()
    .orderBy('entity_type')
    .execute()
  return rows.map((r) => r.entity_type)
}
