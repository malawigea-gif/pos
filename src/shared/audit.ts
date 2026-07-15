import type { DateRange } from './reports'
import type { AuditAction } from '../main/db/types'

export type { AuditAction }

export interface AuditLogFilter {
  entityType?: string
  action?: AuditAction
  userId?: number
  dateRange?: DateRange
  limit?: number
  offset?: number
}

export interface AuditLogEntryView {
  id: number
  userId: number | null
  username: string | null
  fullName: string | null
  action: AuditAction
  entityType: string
  entityId: number
  changes: unknown | null
  createdAt: string
}

export interface AuditLogPage {
  entries: AuditLogEntryView[]
  total: number
}
