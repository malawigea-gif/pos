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

/** A customer paying down what they owe on their credit account. */
export async function recordCreditPayment(db: Kysely<Database>, input: RecordCreditPaymentInput) {
  return db.transaction().execute(async (trx) => {
    const customer = await trx
      .selectFrom('customers')
      .selectAll()
      .where('id', '=', input.customerId)
      .executeTakeFirstOrThrow()

    const newBalance = customer.credit_balance - input.amount
    const updated = await trx
      .updateTable('customers')
      .set({ credit_balance: newBalance, updated_at: new Date().toISOString() })
      .where('id', '=', input.customerId)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'customers',
      entityId: input.customerId,
      before: { credit_balance: customer.credit_balance },
      after: { credit_balance: newBalance }
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
 *  (checkoutSale accrues points as part of the same atomic checkout). */
export async function adjustLoyaltyPointsWithTrx(
  trx: Transaction<Database>,
  input: AdjustLoyaltyPointsInput
): Promise<number> {
  const customer = await trx
    .selectFrom('customers')
    .select(['id', 'loyalty_points'])
    .where('id', '=', input.customerId)
    .executeTakeFirstOrThrow()

  const newPoints = customer.loyalty_points + input.pointsChange
  if (newPoints < 0) {
    throw new InsufficientLoyaltyPointsError(input.customerId, customer.loyalty_points, -input.pointsChange)
  }

  await trx
    .updateTable('customers')
    .set({ loyalty_points: newPoints, updated_at: new Date().toISOString() })
    .where('id', '=', input.customerId)
    .execute()

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
    before: { loyalty_points: customer.loyalty_points },
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
