import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database, PreorderStatus } from '../db/types'
import * as preorders from '../db/repositories/preordersRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler } from './errors'
import type { CreatePreorderRequest, ListPreordersFilter } from '../../shared/preorders'

export function registerPreordersIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'preorders:create',
    ipcHandler(async (input: CreatePreorderRequest) => {
      const userId = getCurrentUserId()
      return preorders.createPreorder(db, { ...input, userId })
    })
  )

  ipcMain.handle(
    'preorders:list',
    ipcHandler((filter: ListPreordersFilter = {}) => preorders.listPreorders(db, filter))
  )

  ipcMain.handle(
    'preorders:updateStatus',
    ipcHandler(async (id: number, status: PreorderStatus) => {
      const userId = getCurrentUserId()
      return preorders.updatePreorderStatus(db, id, status, userId)
    })
  )
}
