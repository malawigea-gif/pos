import { randomUUID } from 'crypto'
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'
import { adjustStockWithTrx } from './stockRepository'
import { adjustLoyaltyPointsWithTrx } from './customersRepository'
import { getSetting } from './settingsRepository'
import { computeSalePricing } from '../../pricing/computeSalePricing'
import type { CartItemInput, PaymentInput } from '../../../shared/sales'

export class CreditNotAllowedError extends Error {
  constructor(public readonly customerId: number | null) {
    super(
      customerId
        ? `Customer ${customerId} does not have a credit account`
        : 'A customer with a credit account must be selected to use credit as a payment method'
    )
    this.name = 'CreditNotAllowedError'
  }
}

export class InsufficientCreditError extends Error {
  constructor(
    public readonly customerId: number,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Customer ${customerId} has only ${available} available credit, cannot charge ${requested}`)
    this.name = 'InsufficientCreditError'
  }
}

export class EmptyCartError extends Error {
  constructor() {
    super('Cannot complete a sale with no items')
    this.name = 'EmptyCartError'
  }
}

export class SaleNotHeldError extends Error {
  constructor(public readonly saleId: number) {
    super(`Sale ${saleId} is not a held sale`)
    this.name = 'SaleNotHeldError'
  }
}

export class PaymentMismatchError extends Error {
  constructor(
    public readonly total: number,
    public readonly paid: number
  ) {
    super(`Payments (${paid}) do not cover the sale total (${total})`)
    this.name = 'PaymentMismatchError'
  }
}

/** Invoice numbers are derived from sales.id, which is an AUTOINCREMENT
 *  primary key — SQLite guarantees these are never reused even after a row
 *  is deleted, which is exactly the "sequential, non-reusable" requirement. */
export function formatInvoiceNo(id: number, date: Date): string {
  return `INV-${date.getFullYear()}-${String(id).padStart(6, '0')}`
}

function lineTotal(item: CartItemInput): number {
  return item.unitPrice * item.quantity
}

function selectSaleItemsView(db: Kysely<Database>) {
  return db
    .selectFrom('sale_items')
    .innerJoin('books', 'books.id', 'sale_items.book_id')
    .select([
      'sale_items.id',
      'sale_items.sale_id',
      'sale_items.book_id',
      'sale_items.quantity',
      'sale_items.unit_price',
      'sale_items.discount_amount',
      'sale_items.tax_amount',
      'sale_items.line_total',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
}

export interface HoldSaleInput {
  items: CartItemInput[]
  userId: number
  customerId?: number
  notes?: string
}

export async function holdSale(db: Kysely<Database>, input: HoldSaleInput) {
  if (input.items.length === 0) throw new EmptyCartError()

  return db.transaction().execute(async (trx) => {
    const subtotal = input.items.reduce((sum, item) => sum + lineTotal(item), 0)

    const sale = await trx
      .insertInto('sales')
      .values({
        // Held sales aren't real invoices yet (they might be abandoned), so
        // they get a placeholder rather than consuming a formatted invoice
        // number — the real one is assigned only on checkout.
        invoice_no: `HELD-${randomUUID()}`,
        customer_id: input.customerId ?? null,
        cashier_id: input.userId,
        status: 'held',
        subtotal,
        discount_total: 0,
        tax_total: 0,
        total: subtotal,
        amount_paid: 0,
        notes: input.notes ?? null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('sale_items')
      .values(
        input.items.map((item) => ({
          sale_id: sale.id,
          book_id: item.bookId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: 0,
          tax_amount: 0,
          line_total: lineTotal(item)
        }))
      )
      .execute()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'sales',
      entityId: sale.id,
      after: { status: 'held', total: sale.total }
    })

    return sale
  })
}

export function listHeldSales(db: Kysely<Database>) {
  return db
    .selectFrom('sales')
    .selectAll()
    .where('status', '=', 'held')
    .orderBy('created_at', 'desc')
    .execute()
}

export async function getSaleWithItems(db: Kysely<Database>, saleId: number) {
  const sale = await db.selectFrom('sales').selectAll().where('id', '=', saleId).executeTakeFirst()
  if (!sale) return undefined

  const items = await selectSaleItemsView(db).where('sale_items.sale_id', '=', saleId).execute()
  const payments = await db
    .selectFrom('sale_payments')
    .selectAll()
    .where('sale_id', '=', saleId)
    .execute()

  return { sale, items, payments }
}

export interface CheckoutInput {
  heldSaleId?: number
  items?: CartItemInput[]
  payments: PaymentInput[]
  userId: number
  customerId?: number
  notes?: string
}

/** Public entry point — opens its own transaction. Extracted as a thin
 *  wrapper around checkoutSaleWithTrx so callers that need to compose
 *  checkout atomically with other writes (e.g. converting a quotation to a
 *  sale) can join the same transaction instead of nesting a second BEGIN,
 *  which SQLite doesn't support. Mirrors the adjustStock/adjustStockWithTrx
 *  split already used in stockRepository.ts. */
export async function checkoutSale(db: Kysely<Database>, input: CheckoutInput) {
  return db.transaction().execute((trx) => checkoutSaleWithTrx(trx, input))
}

export async function checkoutSaleWithTrx(trx: Transaction<Database>, input: CheckoutInput) {
    let saleId: number | undefined
    let cartItems: CartItemInput[]
    let customerId: number | undefined
    // bookId -> existing sale_items.id, for the held-sale path, where the
    // rows already exist (at zero discount/tax) and need updating rather
    // than inserting.
    let heldItemIdByBookId: Map<number, number> | undefined

    if (input.heldSaleId !== undefined) {
      const held = await trx
        .selectFrom('sales')
        .selectAll()
        .where('id', '=', input.heldSaleId)
        .executeTakeFirst()
      if (!held || held.status !== 'held') {
        throw new SaleNotHeldError(input.heldSaleId)
      }
      saleId = held.id
      customerId = held.customer_id ?? undefined

      const existingItems = await trx
        .selectFrom('sale_items')
        .selectAll()
        .where('sale_id', '=', saleId)
        .execute()
      cartItems = existingItems.map((i) => ({
        bookId: i.book_id,
        quantity: i.quantity,
        unitPrice: i.unit_price
      }))
      heldItemIdByBookId = new Map(existingItems.map((i) => [i.book_id, i.id]))
    } else {
      if (!input.items || input.items.length === 0) throw new EmptyCartError()
      cartItems = input.items
      customerId = input.customerId
    }

    // Discounts, combo offers, and tax are computed fresh at the moment of
    // completion (not at hold time), reusing the same transaction so
    // pricing reflects the exact DB state the sale commits against.
    const pricing = await computeSalePricing(trx, cartItems)

    const amountPaid = input.payments.reduce((sum, p) => sum + p.amount, 0)
    if (amountPaid < pricing.total) {
      throw new PaymentMismatchError(pricing.total, amountPaid)
    }

    const creditAmount = input.payments
      .filter((p) => p.method === 'credit')
      .reduce((sum, p) => sum + p.amount, 0)
    if (creditAmount > 0) {
      if (customerId === undefined) throw new CreditNotAllowedError(null)

      const customer = await trx
        .selectFrom('customers')
        .selectAll()
        .where('id', '=', customerId)
        .executeTakeFirstOrThrow()
      if (!customer.is_credit_account) throw new CreditNotAllowedError(customerId)

      const available = customer.credit_limit - customer.credit_balance
      if (creditAmount > available) {
        throw new InsufficientCreditError(customerId, available, creditAmount)
      }

      const newBalance = customer.credit_balance + creditAmount
      await trx
        .updateTable('customers')
        .set({ credit_balance: newBalance, updated_at: new Date().toISOString() })
        .where('id', '=', customerId)
        .execute()
      await recordAudit(trx, {
        userId: input.userId,
        action: 'update',
        entityType: 'customers',
        entityId: customerId,
        before: { credit_balance: customer.credit_balance },
        after: { credit_balance: newBalance }
      })
    }

    if (saleId === undefined) {
      const inserted = await trx
        .insertInto('sales')
        .values({
          invoice_no: `PENDING-${randomUUID()}`,
          customer_id: customerId ?? null,
          cashier_id: input.userId,
          status: 'completed',
          subtotal: pricing.subtotal,
          discount_total: pricing.discountTotal,
          tax_total: pricing.taxTotal,
          total: pricing.total,
          amount_paid: 0,
          notes: input.notes ?? null
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      saleId = inserted.id

      await trx
        .insertInto('sale_items')
        .values(
          pricing.items.map((item) => ({
            sale_id: saleId as number,
            book_id: item.bookId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_amount: item.discountAmount,
            tax_amount: item.taxAmount,
            line_total: item.lineTotal
          }))
        )
        .execute()
    } else {
      for (const item of pricing.items) {
        const itemId = heldItemIdByBookId?.get(item.bookId)
        if (itemId === undefined) continue
        await trx
          .updateTable('sale_items')
          .set({
            discount_amount: item.discountAmount,
            tax_amount: item.taxAmount,
            line_total: item.lineTotal
          })
          .where('id', '=', itemId)
          .execute()
      }
    }

    // Stock is only ever deducted here, at the moment a sale is actually
    // paid — a held sale does not reserve stock. Reusing the Inventory
    // module's adjustStockWithTrx means an insufficient-stock item rolls
    // back the entire transaction: no half-completed sale, no corrupted
    // stock count.
    for (const item of cartItems) {
      await adjustStockWithTrx(trx, {
        bookId: item.bookId,
        changeQty: -item.quantity,
        movementType: 'sale',
        referenceType: 'sale',
        referenceId: saleId,
        userId: input.userId
      })
    }

    if (input.payments.length > 0) {
      await trx
        .insertInto('sale_payments')
        .values(
          input.payments.map((p) => ({
            sale_id: saleId as number,
            method: p.method,
            amount: p.amount,
            reference: p.reference ?? null
          }))
        )
        .execute()
    }

    const now = new Date()
    const invoiceNo = formatInvoiceNo(saleId, now)
    const completed = await trx
      .updateTable('sales')
      .set({
        invoice_no: invoiceNo,
        status: 'completed',
        subtotal: pricing.subtotal,
        discount_total: pricing.discountTotal,
        tax_total: pricing.taxTotal,
        total: pricing.total,
        amount_paid: amountPaid,
        sale_date: now.toISOString(),
        updated_at: now.toISOString()
      })
      .where('id', '=', saleId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'sales',
      entityId: saleId,
      after: {
        status: 'completed',
        invoice_no: invoiceNo,
        total: completed.total,
        amount_paid: amountPaid
      }
    })

    if (customerId !== undefined) {
      const rate = Number((await getSetting(trx, 'loyalty.pointsPerCurrency')) ?? '0')
      const pointsEarned = Math.floor(completed.total * rate)
      if (pointsEarned > 0) {
        await adjustLoyaltyPointsWithTrx(trx, {
          customerId,
          pointsChange: pointsEarned,
          reason: `Purchase ${invoiceNo}`,
          saleId,
          userId: input.userId
        })
      }
    }

    const items = await selectSaleItemsView(trx).where('sale_items.sale_id', '=', saleId).execute()
    const payments = await trx
      .selectFrom('sale_payments')
      .selectAll()
      .where('sale_id', '=', saleId)
      .execute()

    return { sale: completed, items, payments }
}

export interface SaleSearchOptions {
  invoiceNo?: string
  dateFrom?: string
  dateTo?: string
}

export function searchSales(db: Kysely<Database>, options: SaleSearchOptions = {}) {
  let query = db.selectFrom('sales').selectAll().where('status', '!=', 'held')

  if (options.invoiceNo) {
    query = query.where('invoice_no', 'like', `%${options.invoiceNo}%`)
  }
  if (options.dateFrom) {
    query = query.where('sale_date', '>=', options.dateFrom)
  }
  if (options.dateTo) {
    query = query.where('sale_date', '<=', options.dateTo)
  }

  return query.orderBy('sale_date', 'desc').execute()
}
