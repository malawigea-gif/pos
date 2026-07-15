import type { Selectable } from 'kysely'
import type { PreordersTable, PreorderStatus } from '../main/db/types'

export type { PreorderStatus }
export type Preorder = Selectable<PreordersTable>

export interface PreorderView {
  id: number
  customer_id: number
  book_id: number | null
  title: string
  isbn: string | null
  quantity: number
  status: PreorderStatus
  notes: string | null
  created_at: string
  customer_name: string
}

export interface CreatePreorderRequest {
  customerId: number
  title: string
  isbn?: string
  bookId?: number
  quantity?: number
  notes?: string
}

export interface ListPreordersFilter {
  status?: PreorderStatus
  customerId?: number
}
