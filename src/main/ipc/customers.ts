import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as customers from '../db/repositories/customersRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type {
  AdjustLoyaltyPointsRequest,
  CustomerFormInput,
  ListCustomersFilter,
  RecordCreditPaymentRequest
} from '../../shared/customers'

const MANAGE_ROLES = ['admin', 'manager'] as const

export function registerCustomersIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'customers:list',
    ipcHandler((filter: ListCustomersFilter = {}) => customers.listCustomers(db, filter))
  )

  ipcMain.handle(
    'customers:get',
    ipcHandler((id: number) => customers.getCustomerById(db, id))
  )

  ipcMain.handle(
    'customers:create',
    ipcHandler(async (input: CustomerFormInput) => {
      const userId = getCurrentUserId()
      return customers.createCustomer(db, { ...input, userId })
    })
  )

  ipcMain.handle(
    'customers:update',
    ipcHandler(async (id: number, input: CustomerFormInput) => {
      const userId = getCurrentUserId()
      return customers.updateCustomer(db, id, { ...input, userId })
    })
  )

  ipcMain.handle(
    'customers:recordCreditPayment',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: RecordCreditPaymentRequest) => {
        const userId = getCurrentUserId()
        return customers.recordCreditPayment(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'customers:adjustLoyaltyPoints',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: AdjustLoyaltyPointsRequest) => {
        const userId = getCurrentUserId()
        return customers.adjustLoyaltyPoints(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'customers:listLoyaltyTransactions',
    ipcHandler((customerId: number) => customers.listLoyaltyTransactions(db, customerId))
  )
}
