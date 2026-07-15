import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as taxRates from '../db/repositories/taxRatesRepository'
import * as discounts from '../db/repositories/discountsRepository'
import * as comboOffers from '../db/repositories/comboOffersRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type {
  ComboOfferFormInput,
  DiscountFormInput,
  TaxRateFormInput
} from '../../shared/pricing'

// Tax rates and discounts are "settings" in the spec's own RBAC language —
// Manager is explicitly read-only here, only Admin can write.
const ADMIN_ONLY = ['admin'] as const

export function registerPricingIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'pricing:taxRates:list',
    ipcHandler(() => taxRates.listTaxRates(db))
  )
  ipcMain.handle(
    'pricing:taxRates:create',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (input: TaxRateFormInput) => {
        const userId = getCurrentUserId()
        return taxRates.createTaxRate(db, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:taxRates:update',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, input: TaxRateFormInput) => {
        const userId = getCurrentUserId()
        return taxRates.updateTaxRate(db, id, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:taxRates:setActive',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, isActive: boolean) => {
        const userId = getCurrentUserId()
        return taxRates.setTaxRateActive(db, id, isActive, userId)
      })
    )
  )

  ipcMain.handle(
    'pricing:discounts:list',
    ipcHandler(() => discounts.listDiscounts(db))
  )
  ipcMain.handle(
    'pricing:discounts:create',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (input: DiscountFormInput) => {
        const userId = getCurrentUserId()
        return discounts.createDiscount(db, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:discounts:update',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, input: DiscountFormInput) => {
        const userId = getCurrentUserId()
        return discounts.updateDiscount(db, id, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:discounts:setActive',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, isActive: boolean) => {
        const userId = getCurrentUserId()
        return discounts.setDiscountActive(db, id, isActive, userId)
      })
    )
  )

  ipcMain.handle(
    'pricing:comboOffers:list',
    ipcHandler(() => comboOffers.listComboOffers(db))
  )
  ipcMain.handle(
    'pricing:comboOffers:create',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (input: ComboOfferFormInput) => {
        const userId = getCurrentUserId()
        return comboOffers.createComboOffer(db, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:comboOffers:update',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, input: ComboOfferFormInput) => {
        const userId = getCurrentUserId()
        return comboOffers.updateComboOffer(db, id, { ...input, userId })
      })
    )
  )
  ipcMain.handle(
    'pricing:comboOffers:setActive',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, isActive: boolean) => {
        const userId = getCurrentUserId()
        return comboOffers.setComboOfferActive(db, id, isActive, userId)
      })
    )
  )
}
