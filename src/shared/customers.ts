import type { Selectable } from 'kysely'
import type { CustomersTable, LoyaltyTransactionsTable } from '../main/db/types'

export type Customer = Selectable<CustomersTable>
export type LoyaltyTransaction = Selectable<LoyaltyTransactionsTable>

export interface ListCustomersFilter {
  search?: string
}

export interface CustomerFormInput {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  isCreditAccount?: boolean
  creditLimit?: number
}

export interface RecordCreditPaymentRequest {
  customerId: number
  amount: number
}

export interface AdjustLoyaltyPointsRequest {
  customerId: number
  pointsChange: number
  reason: string
}
