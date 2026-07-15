import type { Kysely } from 'kysely'
import type { Database } from '../types'

export interface DateRange {
  /** ISO date/datetime, inclusive lower bound. */
  from: string
  /** ISO date/datetime, inclusive upper bound. */
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

export interface GroupedSalesRow {
  key: string
  label: string | null
  quantitySold: number
  revenue: number
}

/** ISO-8601 week number (Monday-start weeks, first week contains the year's
 *  first Thursday) — the standard, unambiguous definition of "week N". */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function bucketKey(dateIso: string, granularity: SummaryGranularity): string {
  const d = new Date(dateIso)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  if (granularity === 'day') return `${year}-${month}-${day}`
  if (granularity === 'month') return `${year}-${month}`
  const week = String(isoWeekNumber(d)).padStart(2, '0')
  return `${year}-W${week}`
}

// Revenue is net of tax (line_total - tax_amount): tax collected is a
// liability owed to the government, not sales performance, so including it
// would overstate every revenue-based report here.
function netRevenue(lineTotal: number, taxAmount: number): number {
  return lineTotal - taxAmount
}

async function getCompletedSaleLineItems(db: Kysely<Database>, range: DateRange) {
  return db
    .selectFrom('sales')
    .innerJoin('sale_items', 'sale_items.sale_id', 'sales.id')
    .select([
      'sales.id as sale_id',
      'sales.sale_date',
      'sales.cashier_id',
      'sale_items.book_id',
      'sale_items.quantity',
      'sale_items.line_total',
      'sale_items.tax_amount'
    ])
    .where('sales.status', '=', 'completed')
    .where('sales.sale_date', '>=', range.from)
    .where('sales.sale_date', '<=', range.to)
    .execute()
}

export async function getSalesSummary(
  db: Kysely<Database>,
  range: DateRange,
  granularity: SummaryGranularity
): Promise<SalesSummaryRow[]> {
  const rows = await getCompletedSaleLineItems(db, range)

  const buckets = new Map<string, { saleIds: Set<number>; itemsSold: number; revenue: number }>()
  for (const row of rows) {
    const key = bucketKey(row.sale_date, granularity)
    const bucket = buckets.get(key) ?? { saleIds: new Set<number>(), itemsSold: 0, revenue: 0 }
    bucket.saleIds.add(row.sale_id)
    bucket.itemsSold += row.quantity
    bucket.revenue += netRevenue(row.line_total, row.tax_amount)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      salesCount: b.saleIds.size,
      itemsSold: b.itemsSold,
      revenue: b.revenue
    }))
}

async function getBookSalesAggregates(
  db: Kysely<Database>,
  range: DateRange
): Promise<Map<number, { quantitySold: number; revenue: number }>> {
  const rows = await getCompletedSaleLineItems(db, range)
  const map = new Map<number, { quantitySold: number; revenue: number }>()
  for (const row of rows) {
    const entry = map.get(row.book_id) ?? { quantitySold: 0, revenue: 0 }
    entry.quantitySold += row.quantity
    entry.revenue += netRevenue(row.line_total, row.tax_amount)
    map.set(row.book_id, entry)
  }
  return map
}

export async function getBestSellers(
  db: Kysely<Database>,
  range: DateRange,
  limit = 20
): Promise<BookSalesRow[]> {
  const aggregates = await getBookSalesAggregates(db, range)
  const bookIds = [...aggregates.keys()]
  if (bookIds.length === 0) return []

  const books = await db.selectFrom('books').select(['id', 'title', 'isbn']).where('id', 'in', bookIds).execute()
  const rows: BookSalesRow[] = books.map((b) => {
    const agg = aggregates.get(b.id)!
    return { bookId: b.id, title: b.title, isbn: b.isbn, quantitySold: agg.quantitySold, revenue: agg.revenue }
  })

  rows.sort((a, b) => b.quantitySold - a.quantitySold)
  return rows.slice(0, limit)
}

/** Slow movers are active, in-stock books ranked by the least sold in the
 *  range (including zero) — a book with no sales at all is the whole point
 *  of this report, so it must include books absent from the aggregates. */
export async function getSlowMovers(
  db: Kysely<Database>,
  range: DateRange,
  limit = 20
): Promise<BookSalesRow[]> {
  const aggregates = await getBookSalesAggregates(db, range)
  const activeBooks = await db
    .selectFrom('books')
    .select(['id', 'title', 'isbn'])
    .where('is_active', '=', 1)
    .where('stock_qty', '>', 0)
    .execute()

  const rows: BookSalesRow[] = activeBooks.map((b) => {
    const agg = aggregates.get(b.id)
    return {
      bookId: b.id,
      title: b.title,
      isbn: b.isbn,
      quantitySold: agg?.quantitySold ?? 0,
      revenue: agg?.revenue ?? 0
    }
  })

  rows.sort((a, b) => a.quantitySold - b.quantitySold)
  return rows.slice(0, limit)
}

/** Gross profit only: revenue minus cost of goods sold. cogs uses each
 *  book's *current* cost_price, since sale_items only stores the selling
 *  price at time of sale, not a historical cost snapshot — a reasonable
 *  simplification for a shop without frequent cost-price churn, but not a
 *  true historical P&L if costs have since changed. */
export async function getProfitAndLoss(db: Kysely<Database>, range: DateRange): Promise<ProfitLossResult> {
  const rows = await db
    .selectFrom('sales')
    .innerJoin('sale_items', 'sale_items.sale_id', 'sales.id')
    .innerJoin('books', 'books.id', 'sale_items.book_id')
    .select(['sale_items.quantity', 'sale_items.line_total', 'sale_items.tax_amount', 'books.cost_price'])
    .where('sales.status', '=', 'completed')
    .where('sales.sale_date', '>=', range.from)
    .where('sales.sale_date', '<=', range.to)
    .execute()

  let revenue = 0
  let cogs = 0
  for (const row of rows) {
    revenue += netRevenue(row.line_total, row.tax_amount)
    cogs += row.quantity * row.cost_price
  }

  return { revenue, cogs, grossProfit: revenue - cogs }
}

export async function getSalesByCategory(db: Kysely<Database>, range: DateRange): Promise<GroupedSalesRow[]> {
  const rows = await db
    .selectFrom('sales')
    .innerJoin('sale_items', 'sale_items.sale_id', 'sales.id')
    .innerJoin('books', 'books.id', 'sale_items.book_id')
    .leftJoin('categories', 'categories.id', 'books.category_id')
    .select([
      'books.category_id',
      'categories.name as category_name',
      'sale_items.quantity',
      'sale_items.line_total',
      'sale_items.tax_amount'
    ])
    .where('sales.status', '=', 'completed')
    .where('sales.sale_date', '>=', range.from)
    .where('sales.sale_date', '<=', range.to)
    .execute()

  const map = new Map<string, GroupedSalesRow>()
  for (const row of rows) {
    const key = row.category_id != null ? String(row.category_id) : 'uncategorized'
    const entry = map.get(key) ?? { key, label: row.category_name, quantitySold: 0, revenue: 0 }
    entry.quantitySold += row.quantity
    entry.revenue += netRevenue(row.line_total, row.tax_amount)
    map.set(key, entry)
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export async function getSalesByAuthor(db: Kysely<Database>, range: DateRange): Promise<GroupedSalesRow[]> {
  const rows = await db
    .selectFrom('sales')
    .innerJoin('sale_items', 'sale_items.sale_id', 'sales.id')
    .innerJoin('books', 'books.id', 'sale_items.book_id')
    .select(['books.author', 'sale_items.quantity', 'sale_items.line_total', 'sale_items.tax_amount'])
    .where('sales.status', '=', 'completed')
    .where('sales.sale_date', '>=', range.from)
    .where('sales.sale_date', '<=', range.to)
    .execute()

  const map = new Map<string, GroupedSalesRow>()
  for (const row of rows) {
    const key = row.author ?? 'unknown'
    const entry = map.get(key) ?? { key, label: row.author, quantitySold: 0, revenue: 0 }
    entry.quantitySold += row.quantity
    entry.revenue += netRevenue(row.line_total, row.tax_amount)
    map.set(key, entry)
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export async function getSalesByCashier(db: Kysely<Database>, range: DateRange): Promise<GroupedSalesRow[]> {
  const rows = await db
    .selectFrom('sales')
    .innerJoin('sale_items', 'sale_items.sale_id', 'sales.id')
    .innerJoin('users', 'users.id', 'sales.cashier_id')
    .select([
      'sales.cashier_id',
      'users.full_name',
      'sale_items.quantity',
      'sale_items.line_total',
      'sale_items.tax_amount'
    ])
    .where('sales.status', '=', 'completed')
    .where('sales.sale_date', '>=', range.from)
    .where('sales.sale_date', '<=', range.to)
    .execute()

  const map = new Map<string, GroupedSalesRow>()
  for (const row of rows) {
    const key = String(row.cashier_id)
    const entry = map.get(key) ?? { key, label: row.full_name, quantitySold: 0, revenue: 0 }
    entry.quantitySold += row.quantity
    entry.revenue += netRevenue(row.line_total, row.tax_amount)
    map.set(key, entry)
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

/** There's no per-sale supplier lineage in the schema (a book can be
 *  restocked from different suppliers over time without lot tracking), so
 *  "sales by supplier" attributes a book's sales to whichever supplier most
 *  recently supplied it via a Goods Received Note. Books that have never
 *  been received via a GRN (e.g. only ever adjusted in directly) fall under
 *  "unknown". This is a heuristic, not a ground truth — labelled as such in
 *  the UI. */
export async function getSalesBySupplier(db: Kysely<Database>, range: DateRange): Promise<GroupedSalesRow[]> {
  const grnRows = await db
    .selectFrom('grn_items')
    .innerJoin('goods_received_notes', 'goods_received_notes.id', 'grn_items.grn_id')
    .select(['grn_items.book_id', 'goods_received_notes.supplier_id', 'goods_received_notes.received_date'])
    .execute()

  const supplierByBook = new Map<number, number>()
  const latestDateByBook = new Map<number, string>()
  for (const row of grnRows) {
    const existingDate = latestDateByBook.get(row.book_id)
    if (!existingDate || row.received_date > existingDate) {
      latestDateByBook.set(row.book_id, row.received_date)
      supplierByBook.set(row.book_id, row.supplier_id)
    }
  }

  const saleRows = await getCompletedSaleLineItems(db, range)
  const bySupplier = new Map<string, { quantitySold: number; revenue: number }>()
  for (const row of saleRows) {
    const supplierId = supplierByBook.get(row.book_id)
    const key = supplierId != null ? String(supplierId) : 'unknown'
    const entry = bySupplier.get(key) ?? { quantitySold: 0, revenue: 0 }
    entry.quantitySold += row.quantity
    entry.revenue += netRevenue(row.line_total, row.tax_amount)
    bySupplier.set(key, entry)
  }

  const supplierIds = [...bySupplier.keys()].filter((k) => k !== 'unknown').map(Number)
  const suppliers =
    supplierIds.length > 0
      ? await db.selectFrom('suppliers').select(['id', 'name']).where('id', 'in', supplierIds).execute()
      : []
  const nameById = new Map(suppliers.map((s) => [s.id, s.name]))

  return [...bySupplier.entries()]
    .map(([key, agg]) => ({
      key,
      label: key === 'unknown' ? null : (nameById.get(Number(key)) ?? null),
      quantitySold: agg.quantitySold,
      revenue: agg.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue)
}
