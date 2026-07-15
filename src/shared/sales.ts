import type { Selectable } from 'kysely'
import type { PaymentMethod, RegisterClosingsTable, SalePaymentsTable, SalesTable } from '../main/db/types'
import type { ReceiptLanguage } from './receiptLabels'

export type { PaymentMethod }
export type Sale = Selectable<SalesTable>
export type SalePayment = Selectable<SalePaymentsTable>
export type RegisterClosing = Selectable<RegisterClosingsTable>

export interface SaleItemView {
  id: number
  sale_id: number
  book_id: number
  quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  line_total: number
  book_title: string
  book_isbn: string | null
}

export interface SaleWithItems {
  sale: Sale
  items: SaleItemView[]
  payments: SalePayment[]
}

export interface CartItemInput {
  bookId: number
  quantity: number
  unitPrice: number
}

export interface PaymentInput {
  method: PaymentMethod
  amount: number
  reference?: string
}

export interface HoldSaleRequest {
  items: CartItemInput[]
  customerId?: number
  notes?: string
}

export interface CheckoutRequest {
  /** Complete a previously held sale instead of starting a fresh one. */
  heldSaleId?: number
  items?: CartItemInput[]
  payments: PaymentInput[]
  customerId?: number
  notes?: string
  /** Current UI language, used to resolve the receipt language when the
   *  receipt-language setting is "match_ui". */
  uiLanguage: ReceiptLanguage
}

export interface SaleSearchFilter {
  invoiceNo?: string
  dateFrom?: string
  dateTo?: string
}

export interface RegisterCashSummary {
  businessDate: string
  cashSalesTotal: number
  nonCashSalesTotal: number
}

export interface CreateRegisterClosingRequest {
  businessDate: string
  openingFloat: number
  countedCash: number
  notes?: string
}

export interface ReceiptItemLine {
  title: string
  isbn: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ReceiptPaymentLine {
  method: PaymentMethod
  amount: number
}

export type ReceiptPaperSize = 'a4' | 'a5' | '80mm'

export interface ReceiptData {
  saleId: number
  invoiceNo: string
  saleDate: string
  cashierName: string
  items: ReceiptItemLine[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  payments: ReceiptPaymentLine[]
  amountPaid: number
  change: number
  language: ReceiptLanguage
  businessName: string
  phone: string | null
  email: string | null
  address: string | null
  documentType: 'invoice' | 'quotation'
  validUntil?: string | null
}
