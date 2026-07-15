import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'

export function listTaxRates(db: Kysely<Database>) {
  return db.selectFrom('tax_rates').selectAll().orderBy('name').execute()
}

export function getTaxRateById(db: Kysely<Database>, id: number) {
  return db.selectFrom('tax_rates').selectAll().where('id', '=', id).executeTakeFirst()
}

export function getDefaultTaxRate(db: Kysely<Database>) {
  return db.selectFrom('tax_rates').selectAll().where('is_default', '=', 1).executeTakeFirst()
}

export interface TaxRateFormInput {
  name: string
  ratePercent: number
  isExempt?: boolean
  isDefault?: boolean
}

export interface CreateTaxRateInput extends TaxRateFormInput {
  userId: number | null
}

export async function createTaxRate(db: Kysely<Database>, input: CreateTaxRateInput) {
  return db.transaction().execute(async (trx) => {
    if (input.isDefault) {
      await trx.updateTable('tax_rates').set({ is_default: 0 }).execute()
    }

    const taxRate = await trx
      .insertInto('tax_rates')
      .values({
        name: input.name,
        rate_percent: input.ratePercent,
        is_exempt: input.isExempt ? 1 : 0,
        is_default: input.isDefault ? 1 : 0,
        is_active: 1
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'tax_rates',
      entityId: taxRate.id,
      after: { name: taxRate.name, rate_percent: taxRate.rate_percent }
    })

    return taxRate
  })
}

export interface UpdateTaxRateInput extends TaxRateFormInput {
  userId: number | null
}

export async function updateTaxRate(db: Kysely<Database>, id: number, input: UpdateTaxRateInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('tax_rates')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    if (input.isDefault) {
      await trx.updateTable('tax_rates').set({ is_default: 0 }).where('id', '!=', id).execute()
    }

    const after = await trx
      .updateTable('tax_rates')
      .set({
        name: input.name,
        rate_percent: input.ratePercent,
        is_exempt: input.isExempt ? 1 : 0,
        is_default: input.isDefault ? 1 : 0,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'tax_rates',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export async function setTaxRateActive(
  db: Kysely<Database>,
  id: number,
  isActive: boolean,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('tax_rates')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('tax_rates')
      .set({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'tax_rates',
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: after.is_active }
    })

    return after
  })
}
