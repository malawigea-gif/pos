import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'

export class InsufficientLoyaltyPointsError extends Error {
  constructor(
    public readonly customerId: number,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Customer ${customerId} only has ${available} loyalty points, cannot redeem ${requested}`)
    this.name = 'InsufficientLoyaltyPointsError'
  }
}

export interface ListCustomersOptions {
  search?: string
}

export function listCustomers(db: Kysely<Database>, options: ListCustomersOptions = {}) {
  let query = db.selectFrom('customers').selectAll()
  if (options.search) {
    const term = `%${options.search}%`
    query = query.where((eb) =>
      eb.or([eb('name', 'like', term), eb('phone', 'like', term), eb('email', 'like', term)])
    )
  }
  return query.orderBy('name').execute()
}

export function getCustomerById(db: Kysely<Database>, id: number) {
  return db.selectFrom('customers').selectAll().where('id', '=', id).executeTakeFirst()
}

export interface CustomerFormInput {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  isCreditAccount?: boolean
  creditLimit?: number
}

export interface CreateCustomerInput extends CustomerFormInput {
  userId: number | null
}

export async function createCustomer(db: Kysely<Database>, input: CreateCustomerInput) {
  const customer = await db
    .insertInto('customers')
    .values({
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      is_credit_account: input.isCreditAccount ? 1 : 0,
      credit_limit: input.creditLimit ?? 0,
      credit_balance: 0,
      loyalty_points: 0
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordAudit(db, {
    userId: input.userId,
    action: 'create',
    entityType: 'customers',
    entityId: customer.id,
    after: { name: customer.name, is_credit_account: customer.is_credit_account }
  })

  return customer
}

export interface UpdateCustomerInput extends CustomerFormInput {
  userId: number | null
}

export async function updateCustomer(db: Kysely<Database>, id: number, input: UpdateCustomerInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('customers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('customers')
      .set({
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        is_credit_account: input.isCreditAccount ? 1 : 0,
        credit_limit: input.creditLimit ?? 0,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'customers',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export interface RecordCreditPaymentInput {
  customerId: number
  amount: number
  userId: number | null
}

/** A customer paying down what they owe on their credit account. Uses a
 *  single atomic UPDATE (see adjustStockWithTrx's comment in
 *  stockRepository.ts for why a read-then-write here would race under
 *  multi-till Postgres) rather than reading credit_balance first. */
export async function recordCreditPayment(db: Kysely<Database>, input: RecordCreditPaymentInput) {
  return db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('customers')
      .set((eb) => ({
        credit_balance: eb('credit_balance', '-', input.amount),
        updated_at: new Date().toISOString()
      }))
      .where('id', '=', input.customerId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'customers',
      entityId: input.customerId,
      before: { credit_balance: updated.credit_balance + input.amount },
      after: { credit_balance: updated.credit_balance }
    })

    return updated
  })
}

export interface AdjustLoyaltyPointsInput {
  customerId: number
  pointsChange: number
  reason: string
  saleId?: number
  userId: number | null
}

/** Core logic, reusable by callers that already hold an open transaction
 *  (checkoutSale accrues points as part of the same atomic checkout). A
 *  single guarded atomic UPDATE, not read-then-write (see
 *  adjustStockWithTrx's comment in stockRepository.ts) — the WHERE guard
 *  only ever matters when pointsChange is negative (redeeming); it's always
 *  true for a positive pointsChange (earning), matching the original
 *  behavior exactly. */
export async function adjustLoyaltyPointsWithTrx(
  trx: Transaction<Database>,
  input: AdjustLoyaltyPointsInput
): Promise<number> {
  const updated = await trx
    .updateTable('customers')
    .set((eb) => ({
      loyalty_points: eb('loyalty_points', '+', input.pointsChange),
      updated_at: new Date().toISOString()
    }))
    .where('id', '=', input.customerId)
    .where('loyalty_points', '>=', -input.pointsChange)
    .returning(['loyalty_points'])
    .executeTakeFirst()

  if (!updated) {
    // The guard failed (redeeming more points than currently available) —
    // re-read only for a precise error message, not to decide the outcome.
    const current = await trx
      .selectFrom('customers')
      .select('loyalty_points')
      .where('id', '=', input.customerId)
      .executeTakeFirstOrThrow()
    throw new InsufficientLoyaltyPointsError(input.customerId, current.loyalty_points, -input.pointsChange)
  }

  const newPoints = updated.loyalty_points

  await trx
    .insertInto('loyalty_transactions')
    .values({
      customer_id: input.customerId,
      sale_id: input.saleId ?? null,
      points_change: input.pointsChange,
      reason: input.reason
    })
    .execute()

  await recordAudit(trx, {
    userId: input.userId,
    action: 'update',
    entityType: 'customers',
    entityId: input.customerId,
    before: { loyalty_points: newPoints - input.pointsChange },
    after: { loyalty_points: newPoints }
  })

  return newPoints
}

export async function adjustLoyaltyPoints(db: Kysely<Database>, input: AdjustLoyaltyPointsInput) {
  return db.transaction().execute((trx) => adjustLoyaltyPointsWithTrx(trx, input))
}

export function listLoyaltyTransactions(db: Kysely<Database>, customerId: number) {
  return db
    .selectFrom('loyalty_transactions')
    .selectAll()
    .where('customer_id', '=', customerId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .execute()
}
