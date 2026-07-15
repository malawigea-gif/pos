import { randomUUID } from 'crypto'
import type { Kysely, Selectable, Transaction } from 'kysely'
import type { Database, PaymentMethod, ReturnsTable, ReturnStatus, SaleStatus } from '../types'
import { recordAudit } from '../audit'
import { adjustStockWithTrx } from './stockRepository'
import { getSetting, setSetting } from './settingsRepository'

const APPROVAL_THRESHOLD_KEY = 'returns.approvalThreshold'

export class EmptyReturnError extends Error {
  constructor() {
    super('A return must include at least one item')
    this.name = 'EmptyReturnError'
  }
}

export class SaleNotReturnableError extends Error {
  constructor(public readonly saleId: number) {
    super(`Sale ${saleId} is not eligible for returns`)
    this.name = 'SaleNotReturnableError'
  }
}

export class ReturnQuantityExceedsAvailableError extends Error {
  constructor(
    public readonly saleItemId: number,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Only ${available} unit(s) can still be returned for this item, requested ${requested}`)
    this.name = 'ReturnQuantityExceedsAvailableError'
  }
}

export class ReturnNotPendingError extends Error {
  constructor(public readonly returnId: number) {
    super(`Return ${returnId} is not awaiting approval`)
    this.name = 'ReturnNotPendingError'
  }
}

export function formatReturnNo(id: number, date: Date): string {
  return `RET-${date.getFullYear()}-${String(id).padStart(6, '0')}`
}

/** Defaults to 0 (every return needs manager approval) rather than "no
 *  limit" — a financial control like this should be safe-by-default until
 *  a shop deliberately raises it. */
export async function getApprovalThreshold(db: Kysely<Database>): Promise<number> {
  const value = await getSetting(db, APPROVAL_THRESHOLD_KEY)
  return Number(value ?? '0')
}

export function setApprovalThreshold(db: Kysely<Database>, value: number, userId: number | null) {
  return setSetting(db, APPROVAL_THRESHOLD_KEY, String(value), userId)
}

async function getClaimedQuantities(
  trx: Kysely<Database>,
  saleId: number,
  statuses: ReturnStatus[]
): Promise<Map<number, number>> {
  const rows = await trx
    .selectFrom('return_items')
    .innerJoin('returns', 'returns.id', 'return_items.return_id')
    .select(['return_items.sale_item_id', 'return_items.quantity'])
    .where('returns.sale_id', '=', saleId)
    .where('returns.status', 'in', statuses)
    .execute()

  const map = new Map<number, number>()
  for (const row of rows) {
    map.set(row.sale_item_id, (map.get(row.sale_item_id) ?? 0) + row.quantity)
  }
  return map
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

export async function getReturnableSaleItems(
  db: Kysely<Database>,
  saleId: number
): Promise<{ sale: Selectable<Database['sales']>; items: ReturnableSaleItem[] } | undefined> {
  const sale = await db.selectFrom('sales').selectAll().where('id', '=', saleId).executeTakeFirst()
  if (!sale) return undefined

  const items = await db
    .selectFrom('sale_items')
    .innerJoin('books', 'books.id', 'sale_items.book_id')
    .select([
      'sale_items.id',
      'sale_items.book_id',
      'books.title',
      'books.isbn',
      'sale_items.quantity',
      'sale_items.line_total'
    ])
    .where('sale_items.sale_id', '=', saleId)
    .execute()

  const claimed = await getClaimedQuantities(db, saleId, ['pending_approval', 'completed'])

  return {
    sale,
    items: items.map((item) => {
      const alreadyClaimed = claimed.get(item.id) ?? 0
      return {
        saleItemId: item.id,
        bookId: item.book_id,
        bookTitle: item.title,
        bookIsbn: item.isbn,
        quantity: item.quantity,
        unitRefundAmount: item.line_total / item.quantity,
        alreadyClaimed,
        returnable: item.quantity - alreadyClaimed
      }
    })
  }
}

/** Applies everything a completed return actually does to the rest of the
 *  system, shared by the "no approval needed" path in createReturn and by
 *  approveReturn: stock back in, recompute the parent sale's status, and —
 *  in the simple case where the whole original sale was paid on credit —
 *  reduce the customer's credit balance by the refund. (Mixed-payment
 *  sales are left alone here; attributing a partial refund across mixed
 *  tenders is ambiguous, so that's a manual follow-up for the cashier.) */
async function finalizeReturnWithTrx(
  trx: Transaction<Database>,
  returnRow: Selectable<ReturnsTable>,
  approvedBy: number | null,
  actingUserId: number
): Promise<void> {
  const items = await trx
    .selectFrom('return_items')
    .selectAll()
    .where('return_id', '=', returnRow.id)
    .execute()

  for (const item of items) {
    await adjustStockWithTrx(trx, {
      bookId: item.book_id,
      changeQty: item.quantity,
      movementType: 'return',
      referenceType: 'return',
      referenceId: returnRow.id,
      userId: actingUserId
    })
  }

  const sale = await trx
    .selectFrom('sales')
    .selectAll()
    .where('id', '=', returnRow.sale_id)
    .executeTakeFirstOrThrow()
  const saleItems = await trx.selectFrom('sale_items').selectAll().where('sale_id', '=', sale.id).execute()

  const returnedBySaleItem = await getClaimedQuantities(trx, sale.id, ['completed'])
  // This return isn't marked 'completed' in the DB until the very end of
  // this function, so its own items must be folded in manually.
  for (const item of items) {
    returnedBySaleItem.set(item.sale_item_id, (returnedBySaleItem.get(item.sale_item_id) ?? 0) + item.quantity)
  }

  const allFullyReturned = saleItems.every((si) => (returnedBySaleItem.get(si.id) ?? 0) >= si.quantity)
  const anyReturned = saleItems.some((si) => (returnedBySaleItem.get(si.id) ?? 0) > 0)
  const newSaleStatus: SaleStatus = allFullyReturned ? 'returned' : anyReturned ? 'partially_returned' : sale.status

  if (newSaleStatus !== sale.status) {
    await trx
      .updateTable('sales')
      .set({ status: newSaleStatus, updated_at: new Date().toISOString() })
      .where('id', '=', sale.id)
      .execute()
  }

  if (sale.customer_id != null) {
    const payments = await trx.selectFrom('sale_payments').selectAll().where('sale_id', '=', sale.id).execute()
    const paidViaCreditOnly = payments.length > 0 && payments.every((p) => p.method === 'credit')
    if (paidViaCreditOnly) {
      // Atomic guarded UPDATE, not read-then-write — see adjustStockWithTrx's
      // comment in stockRepository.ts for why that matters under multi-till
      // Postgres. No lower-bound guard, matching the original's behavior:
      // a refund can legitimately push a credit balance negative.
      const updated = await trx
        .updateTable('customers')
        .set((eb) => ({
          credit_balance: eb('credit_balance', '-', returnRow.refund_total),
          updated_at: new Date().toISOString()
        }))
        .where('id', '=', sale.customer_id)
        .returningAll()
        .executeTakeFirstOrThrow()

      await recordAudit(trx, {
        userId: actingUserId,
        action: 'update',
        entityType: 'customers',
        entityId: sale.customer_id,
        before: { credit_balance: updated.credit_balance + returnRow.refund_total },
        after: { credit_balance: updated.credit_balance }
      })
    }
  }

  await trx
    .updateTable('returns')
    .set({ status: 'completed', approved_by: approvedBy })
    .where('id', '=', returnRow.id)
    .execute()
}

export interface CreateReturnItemInput {
  saleItemId: number
  quantity: number
}

export interface CreateReturnInput {
  saleId: number
  items: CreateReturnItemInput[]
  reason?: string
  refundMethod?: PaymentMethod
  userId: number
}

export async function createReturn(db: Kysely<Database>, input: CreateReturnInput) {
  return db.transaction().execute(async (trx) => {
    if (input.items.length === 0) throw new EmptyReturnError()

    const sale = await trx.selectFrom('sales').selectAll().where('id', '=', input.saleId).executeTakeFirst()
    if (!sale || (sale.status !== 'completed' && sale.status !== 'partially_returned')) {
      throw new SaleNotReturnableError(input.saleId)
    }

    const saleItems = await trx
      .selectFrom('sale_items')
      .selectAll()
      .where('sale_id', '=', input.saleId)
      .execute()
    const saleItemById = new Map(saleItems.map((i) => [i.id, i]))
    const claimed = await getClaimedQuantities(trx, input.saleId, ['pending_approval', 'completed'])

    let refundTotal = 0
    const preparedItems: { saleItemId: number; bookId: number; quantity: number; refundAmount: number }[] = []
    for (const requested of input.items) {
      const saleItem = saleItemById.get(requested.saleItemId)
      if (!saleItem) {
        throw new Error(`Sale item ${requested.saleItemId} does not belong to sale ${input.saleId}`)
      }
      const available = saleItem.quantity - (claimed.get(requested.saleItemId) ?? 0)
      if (requested.quantity <= 0 || requested.quantity > available) {
        throw new ReturnQuantityExceedsAvailableError(requested.saleItemId, available, requested.quantity)
      }
      const unitRefund = saleItem.line_total / saleItem.quantity
      const refundAmount = unitRefund * requested.quantity
      refundTotal += refundAmount
      preparedItems.push({
        saleItemId: requested.saleItemId,
        bookId: saleItem.book_id,
        quantity: requested.quantity,
        refundAmount
      })
    }

    const threshold = await getApprovalThreshold(trx)
    const needsApproval = refundTotal > threshold

    const inserted = await trx
      .insertInto('returns')
      .values({
        return_no: `PENDING-${randomUUID()}`,
        sale_id: input.saleId,
        processed_by: input.userId,
        approved_by: null,
        status: needsApproval ? 'pending_approval' : 'completed',
        reason: input.reason ?? null,
        refund_total: refundTotal,
        refund_method: input.refundMethod ?? null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('return_items')
      .values(
        preparedItems.map((item) => ({
          return_id: inserted.id,
          sale_item_id: item.saleItemId,
          book_id: item.bookId,
          quantity: item.quantity,
          refund_amount: item.refundAmount
        }))
      )
      .execute()

    const returnNo = formatReturnNo(inserted.id, new Date())
    const returnRow = await trx
      .updateTable('returns')
      .set({ return_no: returnNo })
      .where('id', '=', inserted.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'returns',
      entityId: returnRow.id,
      after: { return_no: returnNo, status: returnRow.status, refund_total: refundTotal }
    })

    if (!needsApproval) {
      await finalizeReturnWithTrx(trx, returnRow, null, input.userId)
    }

    return trx.selectFrom('returns').selectAll().where('id', '=', returnRow.id).executeTakeFirstOrThrow()
  })
}

export async function approveReturn(db: Kysely<Database>, returnId: number, managerUserId: number) {
  return db.transaction().execute(async (trx) => {
    const returnRow = await trx
      .selectFrom('returns')
      .selectAll()
      .where('id', '=', returnId)
      .executeTakeFirstOrThrow()
    if (returnRow.status !== 'pending_approval') {
      throw new ReturnNotPendingError(returnId)
    }

    await finalizeReturnWithTrx(trx, returnRow, managerUserId, managerUserId)

    await recordAudit(trx, {
      userId: managerUserId,
      action: 'update',
      entityType: 'returns',
      entityId: returnId,
      before: { status: 'pending_approval' },
      after: { status: 'completed', approved_by: managerUserId }
    })

    return trx.selectFrom('returns').selectAll().where('id', '=', returnId).executeTakeFirstOrThrow()
  })
}

export async function rejectReturn(
  db: Kysely<Database>,
  returnId: number,
  managerUserId: number,
  reason?: string
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('returns')
      .selectAll()
      .where('id', '=', returnId)
      .executeTakeFirstOrThrow()
    if (before.status !== 'pending_approval') {
      throw new ReturnNotPendingError(returnId)
    }

    const after = await trx
      .updateTable('returns')
      .set({
        status: 'rejected',
        approved_by: managerUserId,
        reason: reason ?? before.reason
      })
      .where('id', '=', returnId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: managerUserId,
      action: 'update',
      entityType: 'returns',
      entityId: returnId,
      before: { status: 'pending_approval' },
      after: { status: 'rejected' }
    })

    return after
  })
}

export interface ListReturnsOptions {
  saleId?: number
  status?: ReturnStatus
}

export function listReturns(db: Kysely<Database>, options: ListReturnsOptions = {}) {
  let query = db.selectFrom('returns').selectAll()
  if (options.saleId !== undefined) query = query.where('sale_id', '=', options.saleId)
  if (options.status !== undefined) query = query.where('status', '=', options.status)
  return query.orderBy('created_at', 'desc').execute()
}

export function listPendingApprovals(db: Kysely<Database>) {
  return listReturns(db, { status: 'pending_approval' })
}

export async function getReturnWithItems(db: Kysely<Database>, returnId: number) {
  const returnRow = await db.selectFrom('returns').selectAll().where('id', '=', returnId).executeTakeFirst()
  if (!returnRow) return undefined

  const items = await db
    .selectFrom('return_items')
    .innerJoin('books', 'books.id', 'return_items.book_id')
    .select([
      'return_items.id',
      'return_items.return_id',
      'return_items.sale_item_id',
      'return_items.book_id',
      'return_items.quantity',
      'return_items.refund_amount',
      'books.title as book_title',
      'books.isbn as book_isbn'
    ])
    .where('return_items.return_id', '=', returnId)
    .execute()

  return { return: returnRow, items }
}
