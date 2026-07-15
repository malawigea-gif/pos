import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as suppliers from '../db/repositories/suppliersRepository'
import * as supplierPayments from '../db/repositories/supplierPaymentsRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type {
  CreateSupplierPaymentRequest,
  ListSuppliersFilter,
  ListSupplierPaymentsFilter,
  SupplierFormInput
} from '../../shared/suppliers'

const MANAGE_ROLES = ['admin', 'manager'] as const

export function registerSuppliersIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'suppliers:list',
    ipcHandler((filter: ListSuppliersFilter = {}) => suppliers.listSuppliers(db, filter))
  )

  ipcMain.handle(
    'suppliers:get',
    ipcHandler((id: number) => suppliers.getSupplierById(db, id))
  )

  ipcMain.handle(
    'suppliers:create',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: SupplierFormInput) => {
        const userId = getCurrentUserId()
        return suppliers.createSupplier(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'suppliers:update',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (id: number, input: SupplierFormInput) => {
        const userId = getCurrentUserId()
        return suppliers.updateSupplier(db, id, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'suppliers:payments:create',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: CreateSupplierPaymentRequest) => {
        const userId = getCurrentUserId()
        return supplierPayments.createSupplierPayment(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'suppliers:payments:markPaid',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (paymentId: number) => {
        const userId = getCurrentUserId()
        return supplierPayments.markSupplierPaymentPaid(db, paymentId, userId)
      })
    )
  )

  ipcMain.handle(
    'suppliers:payments:list',
    ipcHandler((filter: ListSupplierPaymentsFilter = {}) => supplierPayments.listSupplierPayments(db, filter))
  )
}
