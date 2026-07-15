import type { Selectable } from 'kysely'
import type { BooksTable, CategoriesTable, StockMovementsTable, StockTakesTable } from '../main/db/types'

export type Book = Selectable<BooksTable>
export type Category = Selectable<CategoriesTable>
export type StockMovement = Selectable<StockMovementsTable>
export type StockTake = Selectable<StockTakesTable>

export interface StockTakeItemView {
  id: number
  stock_take_id: number
  book_id: number
  expected_qty: number
  counted_qty: number | null
  notes: string | null
  book_title: string
  book_isbn: string | null
}

export interface ListBooksFilter {
  search?: string
  categoryId?: number
  activeOnly?: boolean
}

export interface BookFormInput {
  isbn?: string | null
  barcode?: string | null
  title: string
  author?: string | null
  publisher?: string | null
  brand?: string | null
  categoryId?: number | null
  /** New category name, used when the user types a category that doesn't
   *  exist yet in the select-or-create combo. Takes precedence over categoryId. */
  categoryName?: string | null
  language?: string | null
  taxRateId?: number | null
  costPrice: number
  sellingPrice: number
  reorderLevel?: number
  shelfLocation?: string | null
}

export interface CreateBookFormInput extends BookFormInput {
  initialStockQty?: number
}

export type StockAdjustReason = 'adjustment' | 'write_off'

export interface AdjustStockRequest {
  bookId: number
  changeQty: number
  reason: StockAdjustReason
  notes?: string
}
