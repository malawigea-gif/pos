import type { Selectable } from 'kysely'
import type { PaymentMethod, ReturnsTable, ReturnStatus } from '../main/db/types'
import type { Sale } from './sales'

export type { ReturnStatus }
export type Return = Selectable<ReturnsTable>

export interface ReturnItemView {
  id: number
  return_id: number
  sale_item_id: number
  book_id: number
  quantity: number
  refund_amount: number
  book_title: string
  book_isbn: string | null
}

export interface ReturnableSaleItem {
  saleItemId: number
  bookId: number
  bookTitle: string
  bookIsbn: string | null
  quantity: number
  unitRefundAmount: number
  alreadyClaimed: number
  returnable: number
}

export interface ReturnableSaleInfo {
  sale: Sale
  items: ReturnableSaleItem[]
}

export interface CreateReturnItemInput {
  saleItemId: number
  quantity: number
}

export interface CreateReturnRequest {
  saleId: number
  items: CreateReturnItemInput[]
  reason?: string
  refundMethod?: PaymentMethod
}
