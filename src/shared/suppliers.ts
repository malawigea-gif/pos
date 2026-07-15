import type { Selectable } from 'kysely'
import type { SupplierPaymentsTable, SuppliersTable } from '../main/db/types'

export type Supplier = Selectable<SuppliersTable>
export type SupplierPayment = Selectable<SupplierPaymentsTable>

export interface ListSuppliersFilter {
  search?: string
}

export interface SupplierFormInput {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface CreateSupplierPaymentRequest {
  supplierId: number
  amount: number
  method?: string
  reference?: string
  dueDate?: string
  paidImmediately?: boolean
}

export interface ListSupplierPaymentsFilter {
  supplierId?: number
  onlyUnpaid?: boolean
}
