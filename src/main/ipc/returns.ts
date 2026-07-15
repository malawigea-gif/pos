import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database, ReturnStatus } from '../db/types'
import * as returns from '../db/repositories/returnsRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type { CreateReturnRequest } from '../../shared/returns'

const MANAGE_ROLES = ['admin', 'manager'] as const

export function registerReturnsIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'returns:getReturnableSaleItems',
    ipcHandler((saleId: number) => returns.getReturnableSaleItems(db, saleId))
  )

  ipcMain.handle(
    'returns:create',
    ipcHandler(async (input: CreateReturnRequest) => {
      const userId = getCurrentUserId()
      return returns.createReturn(db, { ...input, userId })
    })
  )

  ipcMain.handle(
    'returns:approve',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (returnId: number) => {
        const userId = getCurrentUserId()
        return returns.approveReturn(db, returnId, userId)
      })
    )
  )

  ipcMain.handle(
    'returns:reject',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (returnId: number, reason?: string) => {
        const userId = getCurrentUserId()
        return returns.rejectReturn(db, returnId, userId, reason)
      })
    )
  )

  ipcMain.handle(
    'returns:list',
    ipcHandler((options: { saleId?: number; status?: ReturnStatus } = {}) => returns.listReturns(db, options))
  )

  ipcMain.handle(
    'returns:listPendingApprovals',
    ipcHandler(() => returns.listPendingApprovals(db))
  )

  ipcMain.handle(
    'returns:getWithItems',
    ipcHandler((returnId: number) => returns.getReturnWithItems(db, returnId))
  )

  ipcMain.handle(
    'returns:getApprovalThreshold',
    ipcHandler(() => returns.getApprovalThreshold(db))
  )

  ipcMain.handle(
    'returns:setApprovalThreshold',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (value: number) => {
        const userId = getCurrentUserId()
        await returns.setApprovalThreshold(db, value, userId)
      })
    )
  )
}
