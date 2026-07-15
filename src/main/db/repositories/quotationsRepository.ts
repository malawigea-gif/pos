import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import type { Database, QuotationStatus } from '../types'
import { recordAudit } from '../audit'
import { checkoutSaleWithTrx } from './salesRepository'
import type { CartItemInput, PaymentInput } from '../../../shared/sales'

export class QuotationNotFoundError extends Error {
  constructor(public readonly quotationId: number) {
    super(`Quotation ${quotationId} was not found`)
    this.name = 'QuotationNotFoundError'
  }
}

export class QuotationNotOpenError extends Error {
  constructor(
    public readonly quotationId: number,
    public readonly status: QuotationStatus
  ) {
    super(`Quotation ${quotationId} is ${status}, not open`)
    this.name = 'QuotationNotOpenError'
  }
}

/** Quotation numbers are derived from quotations.id, same reasoning as
 *  formatInvoiceNo in salesRepository.ts — AUTOINCREMENT ids are never
 *  reused, even after a row is deleted. */
export function formatQuotationNo(id: number, date: Date): string {
  return `QUO-${date.getFullYear()}-${String(id).padStart(6, '0')}`
}

function lineTotal(item: CartItemInput): number {
  return item.unitPrice * item.quantity
}

function selectQuotationItemsView(db: Kysely<Database>) {
  return db
    .selectFrom('quotation_items')
    .innerJoin('books', 'books.id', 'quotation_items.book_id')
    .select([
      'quotation_items.id',
      'quotation_items.quotation_id',
      'quotation_items.book_id',
      'quotation_items.quantity',
      'quotation_items.unit_price',
      'quotation_items.discount_amount',
      'quotation_items.tax_amount',
      'quotation_items.line_total',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
}

export interface CreateQuotationInput {
  items: CartItemInput[]
  customerId?: number
  validUntil?: string
  notes?: string
  userId: number
}

/** Deliberately does not touch stock_qty or stock_movements — a quotation
 *  is only a printable price estimate. Pricing here is a plain sum, not
 *  run through computeSalePricing, exactly like holdSale: discounts/combos/
 *  tax are only computed for real once the quotation is converted to a
 *  sale (see convertQuotationToSale), reusing checkoutSaleWithTrx. */
export async function createQuotation(db: Kysely<Database>, input: CreateQuotationInput) {
  return db.transaction().execute(async (trx) => {
    const subtotal = input.items.reduce((sum, item) => sum + lineTotal(item), 0)

    const quotation = await trx
      .insertInto('quotations')
      .values({
        quote_no: `PENDING-${randomUUID()}`,
        customer_id: input.customerId ?? null,
        created_by: input.userId,
        status: 'open',
        subtotal,
        discount_total: 0,
        tax_total: 0,
        total: subtotal,
        valid_until: input.validUntil ?? null,
        notes: input.notes ?? null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('quotation_items')
      .values(
        input.items.map((item) => ({
          quotation_id: quotation.id,
          book_id: item.bookId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: 0,
          tax_amount: 0,
          line_total: lineTotal(item)
        }))
      )
      .execute()

    const quoteNo = formatQuotationNo(quotation.id, new Date())
    const completed = await trx
      .updateTable('quotations')
      .set({ quote_no: quoteNo, updated_at: new Date().toISOString() })
      .where('id', '=', quotation.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'quotations',
      entityId: quotation.id,
      after: { quote_no: quoteNo, status: 'open', total: subtotal }
    })

    return completed
  })
}

export interface ListQuotationsOptions {
  status?: QuotationStatus
  customerId?: number
  dateFrom?: string
  dateTo?: string
}

export function listQuotations(db: Kysely<Database>, options: ListQuotationsOptions = {}) {
  let query = db.selectFrom('quotations').selectAll()
  if (options.status !== undefined) query = query.where('status', '=', options.status)
  if (options.customerId !== undefined) query = query.where('customer_id', '=', options.customerId)
  if (options.dateFrom) query = query.where('quote_date', '>=', options.dateFrom)
  if (options.dateTo) query = query.where('quote_date', '<=', options.dateTo)
  return query.orderBy('quote_date', 'desc').execute()
}

export async function getQuotationWithItems(db: Kysely<Database>, quotationId: number) {
  const quotation = await db.selectFrom('quotations').selectAll().where('id', '=', quotationId).executeTakeFirst()
  if (!quotation) return undefined

  const items = await selectQuotationItemsView(db).where('quotation_items.quotation_id', '=', quotationId).execute()
  return { quotation, items }
}

export async function voidQuotation(
  db: Kysely<Database>,
  quotationId: number,
  userId: number,
  reason?: string
) {
  return db.transaction().execute(async (trx) => {
    const quotation = await trx
      .selectFrom('quotations')
      .selectAll()
      .where('id', '=', quotationId)
      .executeTakeFirst()
    if (!quotation) throw new QuotationNotFoundError(quotationId)
    if (quotation.status !== 'open') throw new QuotationNotOpenError(quotationId, quotation.status)

    const after = await trx
      .updateTable('quotations')
      .set({
        status: 'cancelled',
        notes: reason ?? quotation.notes,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', quotationId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'quotations',
      entityId: quotationId,
      before: { status: quotation.status },
      after: { status: 'cancelled' }
    })

    return after
  })
}

/** The only place a quotation ever affects stock: this composes with
 *  checkoutSaleWithTrx (see salesRepository.ts) inside ONE transaction, so
 *  the quotation's status flip and the resulting sale/stock-deduction
 *  either both commit or both roll back together. Pricing (discounts,
 *  combos, tax) is computed fresh here via checkoutSaleWithTrx's own call
 *  to computeSalePricing — whatever the quotation estimated at creation
 *  time is not treated as authoritative. */
export async function convertQuotationToSale(
  db: Kysely<Database>,
  quotationId: number,
  payments: PaymentInput[],
  userId: number
) {
  return db.transaction().execute(async (trx) => {
    const quotation = await trx
      .selectFrom('quotations')
      .selectAll()
      .where('id', '=', quotationId)
      .executeTakeFirst()
    if (!quotation) throw new QuotationNotFoundError(quotationId)
    if (quotation.status !== 'open') throw new QuotationNotOpenError(quotationId, quotation.status)

    const quotationItems = await trx
      .selectFrom('quotation_items')
      .selectAll()
      .where('quotation_id', '=', quotationId)
      .execute()
    const cartItems: CartItemInput[] = quotationItems.map((item) => ({
      bookId: item.book_id,
      quantity: item.quantity,
      unitPrice: item.unit_price
    }))

    const result = await checkoutSaleWithTrx(trx, {
      items: cartItems,
      payments,
      customerId: quotation.customer_id ?? undefined,
      userId
    })

    await trx
      .updateTable('quotations')
      .set({ status: 'converted', updated_at: new Date().toISOString() })
      .where('id', '=', quotationId)
      .execute()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'quotations',
      entityId: quotationId,
      before: { status: 'open' },
      after: { status: 'converted', sale_id: result.sale.id }
    })

    return result
  })
}
