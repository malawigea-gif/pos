import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { listAuditEntityTypes, listAuditLog } from '../db/repositories/auditRepository'
import { ipcHandler, withRole } from './errors'
import type { AuditLogFilter, AuditLogPage } from '../../shared/audit'

const ADMIN_ONLY = ['admin'] as const

export function registerAuditIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'audit:list',
    ipcHandler(
      withRole([...ADMIN_ONLY], (filter?: AuditLogFilter): Promise<AuditLogPage> => listAuditLog(db, filter))
    )
  )

  ipcMain.handle(
    'audit:listEntityTypes',
    ipcHandler(withRole([...ADMIN_ONLY], (): Promise<string[]> => listAuditEntityTypes(db)))
  )
}
