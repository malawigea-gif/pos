export interface DateRange {
  from: string
  to: string
}

export type SummaryGranularity = 'day' | 'week' | 'month'

export interface SalesSummaryRow {
  period: string
  salesCount: number
  itemsSold: number
  revenue: number
}

export interface BookSalesRow {
  bookId: number
  title: string
  isbn: string | null
  quantitySold: number
  revenue: number
}

export interface ProfitLossResult {
  revenue: number
  cogs: number
  grossProfit: number
}

export type SalesGroupBy = 'category' | 'author' | 'supplier' | 'cashier'

export interface GroupedSalesRow {
  key: string
  label: string | null
  quantitySold: number
  revenue: number
}

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

/** A fully-localized, fully-formatted table, built by the renderer (which
 *  has react-i18next) and handed to main just to lay out — main process
 *  export code stays language-agnostic. */
export interface ReportTableSpec {
  title: string
  generatedAt: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  totals?: Record<string, string | number>
}
