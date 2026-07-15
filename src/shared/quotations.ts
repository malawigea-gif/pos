import type { Selectable } from 'kysely'
import type { QuotationItemsTable, QuotationsTable, QuotationStatus } from '../main/db/types'
import type { CartItemInput, PaymentInput } from './sales'

export type { QuotationStatus }
export type Quotation = Selectable<QuotationsTable>
export type QuotationItem = Selectable<QuotationItemsTable>

export interface QuotationItemView {
  id: number
  quotation_id: number
  book_id: number
  quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  line_total: number
  book_title: string
  book_isbn: string | null
}

export interface QuotationWithItems {
  quotation: Quotation
  items: QuotationItemView[]
}

export interface CreateQuotationRequest {
  items: CartItemInput[]
  customerId?: number
  validUntil?: string
  notes?: string
}

export interface ListQuotationsFilter {
  status?: QuotationStatus
  customerId?: number
  dateFrom?: string
  dateTo?: string
}

export interface ConvertQuotationRequest {
  payments: PaymentInput[]
}
