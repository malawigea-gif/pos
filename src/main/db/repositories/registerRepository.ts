import { sql, type Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'
import type { RegisterCashSummary } from '../../../shared/sales'

export async function computeCashSummary(
  db: Kysely<Database>,
  businessDate: string
): Promise<RegisterCashSummary> {
  const rows = await db
    .selectFrom('sale_payments')
    .innerJoin('sales', 'sales.id', 'sale_payments.sale_id')
    .select(['sale_payments.method', 'sale_payments.amount'])
    .where(sql<boolean>`date(sales.sale_date) = ${businessDate}`)
    .where('sales.status', '=', 'completed')
    .execute()

  let cashSalesTotal = 0
  let nonCashSalesTotal = 0
  for (const row of rows) {
    if (row.method === 'cash') {
      cashSalesTotal += row.amount
    } else {
      nonCashSalesTotal += row.amount
    }
  }

  return { businessDate, cashSalesTotal, nonCashSalesTotal }
}

export interface CreateRegisterClosingInput {
  businessDate: string
  openingFloat: number
  countedCash: number
  notes?: string
  userId: number | null
}

export async function createRegisterClosing(db: Kysely<Database>, input: CreateRegisterClosingInput) {
  return db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom('sale_payments')
      .innerJoin('sales', 'sales.id', 'sale_payments.sale_id')
      .select(['sale_payments.method', 'sale_payments.amount'])
      .where(sql<boolean>`date(sales.sale_date) = ${input.businessDate}`)
      .where('sales.status', '=', 'completed')
      .execute()

    let cashSalesTotal = 0
    let nonCashSalesTotal = 0
    for (const row of rows) {
      if (row.method === 'cash') cashSalesTotal += row.amount
      else nonCashSalesTotal += row.amount
    }

    const expectedCash = input.openingFloat + cashSalesTotal
    const variance = input.countedCash - expectedCash

    const closing = await trx
      .insertInto('register_closings')
      .values({
        business_date: input.businessDate,
        opening_float: input.openingFloat,
        cash_sales_total: cashSalesTotal,
        non_cash_sales_total: nonCashSalesTotal,
        counted_cash: input.countedCash,
        variance,
        closed_by: input.userId,
        notes: input.notes ?? null
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'register_closings',
      entityId: closing.id,
      after: { business_date: closing.business_date, variance: closing.variance }
    })

    return closing
  })
}

export function listRegisterClosings(db: Kysely<Database>) {
  return db
    .selectFrom('register_closings')
    .selectAll()
    .orderBy('business_date', 'desc')
    .orderBy('id', 'desc')
    .execute()
}
