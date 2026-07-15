import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'

export interface CreateSupplierPaymentInput {
  supplierId: number
  amount: number
  method?: string
  reference?: string
  dueDate?: string
  /** If true, the payment is recorded as already made (paid now) and the
   *  supplier's balance is reduced immediately. Otherwise it's scheduled
   *  (due_date set, paid_date null) for due-date tracking — see
   *  markSupplierPaymentPaid to settle it later. */
  paidImmediately?: boolean
  userId: number | null
}

export async function createSupplierPayment(db: Kysely<Database>, input: CreateSupplierPaymentInput) {
  return db.transaction().execute(async (trx) => {
    const paidDate = input.paidImmediately ? new Date().toISOString() : null

    const payment = await trx
      .insertInto('supplier_payments')
      .values({
        supplier_id: input.supplierId,
        amount: input.amount,
        method: input.method ?? null,
        reference: input.reference ?? null,
        due_date: input.dueDate ?? null,
        paid_date: paidDate,
        created_by: input.userId
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    if (paidDate) {
      const supplier = await trx
        .selectFrom('suppliers')
        .select(['id', 'balance'])
        .where('id', '=', input.supplierId)
        .executeTakeFirstOrThrow()
      const newBalance = supplier.balance - input.amount
      await trx
        .updateTable('suppliers')
        .set({ balance: newBalance, updated_at: new Date().toISOString() })
        .where('id', '=', input.supplierId)
        .execute()
      await recordAudit(trx, {
        userId: input.userId,
        action: 'update',
        entityType: 'suppliers',
        entityId: input.supplierId,
        before: { balance: supplier.balance },
        after: { balance: newBalance }
      })
    }

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'supplier_payments',
      entityId: payment.id,
      after: { amount: payment.amount, paid_date: payment.paid_date }
    })

    return payment
  })
}

export async function markSupplierPaymentPaid(
  db: Kysely<Database>,
  paymentId: number,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const payment = await trx
      .selectFrom('supplier_payments')
      .selectAll()
      .where('id', '=', paymentId)
      .executeTakeFirstOrThrow()

    if (payment.paid_date) return payment

    const paidDate = new Date().toISOString()
    const updated = await trx
      .updateTable('supplier_payments')
      .set({ paid_date: paidDate })
      .where('id', '=', paymentId)
      .returningAll()
      .executeTakeFirstOrThrow()

    const supplier = await trx
      .selectFrom('suppliers')
      .select(['id', 'balance'])
      .where('id', '=', payment.supplier_id)
      .executeTakeFirstOrThrow()
    const newBalance = supplier.balance - payment.amount
    await trx
      .updateTable('suppliers')
      .set({ balance: newBalance, updated_at: new Date().toISOString() })
      .where('id', '=', payment.supplier_id)
      .execute()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'supplier_payments',
      entityId: paymentId,
      before: { paid_date: null },
      after: { paid_date: paidDate }
    })

    return updated
  })
}

export interface ListSupplierPaymentsOptions {
  supplierId?: number
  onlyUnpaid?: boolean
}

export function listSupplierPayments(db: Kysely<Database>, options: ListSupplierPaymentsOptions = {}) {
  let query = db.selectFrom('supplier_payments').selectAll()
  if (options.supplierId !== undefined) {
    query = query.where('supplier_id', '=', options.supplierId)
  }
  if (options.onlyUnpaid) {
    query = query.where('paid_date', 'is', null)
  }
  return query.orderBy('due_date').execute()
}
