import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database, PurchaseOrderStatus } from '../db/types'
import * as po from '../db/repositories/purchaseOrdersRepository'
import * as grn from '../db/repositories/grnRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type { CreateGrnRequest, CreatePurchaseOrderRequest } from '../../shared/purchasing'

const MANAGE_ROLES = ['admin', 'manager'] as const

export function registerPurchasingIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'purchaseOrders:create',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: CreatePurchaseOrderRequest) => {
        const userId = getCurrentUserId()
        return po.createPurchaseOrder(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'purchaseOrders:list',
    ipcHandler((options: { supplierId?: number; status?: PurchaseOrderStatus } = {}) =>
      po.listPurchaseOrders(db, options)
    )
  )

  ipcMain.handle(
    'purchaseOrders:getWithItems',
    ipcHandler((id: number) => po.getPurchaseOrderWithItems(db, id))
  )

  ipcMain.handle(
    'purchaseOrders:updateStatus',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (id: number, status: PurchaseOrderStatus) => {
        const userId = getCurrentUserId()
        return po.updatePurchaseOrderStatus(db, id, status, userId)
      })
    )
  )

  ipcMain.handle(
    'grn:create',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: CreateGrnRequest) => {
        const userId = getCurrentUserId()
        return grn.createGrn(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'grn:list',
    ipcHandler((supplierId?: number) => grn.listGrns(db, supplierId))
  )

  ipcMain.handle(
    'grn:getWithItems',
    ipcHandler((id: number) => grn.getGrnWithItems(db, id))
  )
}
