import type { Kysely } from 'kysely'
import type { AuditAction, Database } from './types'

interface RecordAuditInput {
  userId: number | null
  action: AuditAction
  entityType: string
  entityId: number
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

export async function recordAudit(db: Kysely<Database>, input: RecordAuditInput): Promise<void> {
  const changes = buildChanges(input.action, input.before, input.after)
  await db
    .insertInto('audit_log')
    .values({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      changes: changes ? JSON.stringify(changes) : null
    })
    .execute()
}

function buildChanges(
  action: AuditAction,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): unknown {
  if (action === 'create') return after ?? null
  if (action === 'delete') return before ?? null

  if (!before || !after) return null
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) {
      diff[key] = { old: before[key], new: after[key] }
    }
  }
  return Object.keys(diff).length > 0 ? diff : null
}
