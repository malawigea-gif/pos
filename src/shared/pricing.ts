import type { Selectable } from 'kysely'
import type {
  ComboOffersTable,
  ComboScope,
  DiscountScope,
  DiscountsTable,
  DiscountType,
  TaxRatesTable
} from '../main/db/types'

export type { ComboScope, DiscountScope, DiscountType }
export type TaxRate = Selectable<TaxRatesTable>
export type Discount = Selectable<DiscountsTable>
export type ComboOffer = Selectable<ComboOffersTable>

export interface TaxRateFormInput {
  name: string
  ratePercent: number
  isExempt?: boolean
  isDefault?: boolean
}

export interface DiscountFormInput {
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  bookId?: number | null
  categoryId?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface ComboOfferFormInput {
  name: string
  buyQuantity: number
  freeQuantity: number
  scope: ComboScope
  bookId?: number | null
  categoryId?: number | null
  startsAt?: string | null
  endsAt?: string | null
}
