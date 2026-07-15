import type { Selectable } from 'kysely'
import type { GoodsReceivedNotesTable, PurchaseOrdersTable } from '../main/db/types'

export type { PurchaseOrderStatus } from '../main/db/types'
export type PurchaseOrder = Selectable<PurchaseOrdersTable>
export type Grn = Selectable<GoodsReceivedNotesTable>

export interface PurchaseOrderItemView {
  id: number
  purchase_order_id: number
  book_id: number
  quantity: number
  unit_cost: number
  book_title: string
  book_isbn: string | null
}

export interface GrnItemView {
  id: number
  grn_id: number
  book_id: number
  quantity: number
  unit_cost: number
  line_total: number
  book_title: string
  book_isbn: string | null
}

export interface PurchaseOrderLineInput {
  bookId: number
  quantity: number
  unitCost: number
}

export interface CreatePurchaseOrderRequest {
  supplierId: number
  items: PurchaseOrderLineInput[]
  expectedDate?: string
  notes?: string
}

export interface CreateGrnRequest {
  supplierId: number
  purchaseOrderId?: number
  items: PurchaseOrderLineInput[]
  notes?: string
}
