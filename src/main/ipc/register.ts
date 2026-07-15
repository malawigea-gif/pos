import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as register from '../db/repositories/registerRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler } from './errors'
import type { CreateRegisterClosingRequest } from '../../shared/sales'

export function registerRegisterIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'register:summary',
    ipcHandler((businessDate: string) => register.computeCashSummary(db, businessDate))
  )

  ipcMain.handle(
    'register:close',
    ipcHandler(async (input: CreateRegisterClosingRequest) => {
      const userId = getCurrentUserId()
      return register.createRegisterClosing(db, {
        businessDate: input.businessDate,
        openingFloat: input.openingFloat,
        countedCash: input.countedCash,
        notes: input.notes,
        userId
      })
    })
  )

  ipcMain.handle(
    'register:list',
    ipcHandler(() => register.listRegisterClosings(db))
  )
}
