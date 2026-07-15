import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import {
  createTaxRate,
  getDefaultTaxRate,
  listTaxRates,
  updateTaxRate
} from '../../../src/main/db/repositories/taxRatesRepository'

describe('taxRatesRepository', () => {
  it('seeds exactly one default tax rate on a fresh database', async () => {
    const { db } = await createTestDb()
    const rates = await listTaxRates(db)
    expect(rates).toHaveLength(1)
    expect(rates[0].is_default).toBe(1)
    await db.destroy()
  })

  it('creating a new default tax rate unsets the previous default', async () => {
    const { db, adminId } = await createTestDb()

    const standard = await createTaxRate(db, {
      name: 'Standard VAT',
      ratePercent: 18,
      isDefault: true,
      userId: adminId
    })
    expect(standard.is_default).toBe(1)

    const original = await getDefaultTaxRate(db)
    expect(original?.id).toBe(standard.id)

    const rates = await listTaxRates(db)
    const seeded = rates.find((r) => r.id !== standard.id)
    expect(seeded?.is_default).toBe(0)

    await db.destroy()
  })

  it('updateTaxRate can move the default flag to another rate', async () => {
    const { db, adminId } = await createTestDb()
    const seeded = (await listTaxRates(db))[0]
    const vat = await createTaxRate(db, { name: 'VAT', ratePercent: 18, userId: adminId })

    await updateTaxRate(db, vat.id, {
      name: 'VAT',
      ratePercent: 18,
      isDefault: true,
      userId: adminId
    })

    const rates = await listTaxRates(db)
    expect(rates.find((r) => r.id === vat.id)?.is_default).toBe(1)
    expect(rates.find((r) => r.id === seeded.id)?.is_default).toBe(0)

    await db.destroy()
  })
})
