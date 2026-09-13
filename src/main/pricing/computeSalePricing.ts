import type { Kysely, Selectable } from 'kysely'
import type { ComboOffersTable, Database, DiscountsTable } from '../db/types'
import type { CartItemInput } from '../../shared/sales'
import { resolveUnitDefaultPriceByLabel } from '../../shared/receiptPricing'

type Discount = Selectable<DiscountsTable>
type ComboOffer = Selectable<ComboOffersTable>

export interface PricedLineItem {
  bookId: number
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
  unitLabel: string | null
  stockQuantity: number
  priceOverridden: boolean
}

export interface SalePricing {
  items: PricedLineItem[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
}

/** Picks the single most specific applicable promotion for a line: an
 *  item-specific one beats a category-wide one, which beats a
 *  shop-wide ("all") one. Promotions don't stack — this keeps pricing
 *  predictable for a cashier and easy for a shop owner to reason about. */
function findBestMatch<T extends { scope: string; book_id: number | null; category_id: number | null }>(
  candidates: T[],
  bookId: number,
  categoryId: number | null
): T | undefined {
  const itemMatch = candidates.find((c) => c.scope === 'item' && c.book_id === bookId)
  if (itemMatch) return itemMatch
  if (categoryId !== null) {
    const categoryMatch = candidates.find((c) => c.scope === 'category' && c.category_id === categoryId)
    if (categoryMatch) return categoryMatch
  }
  return candidates.find((c) => c.scope === 'all')
}

/** A discount's wholesale (min_quantity) and loyalty-customer conditions are
 *  filters layered on top of scope, not a scope of their own — so they're
 *  applied before findBestMatch ever runs, against the specific cart line
 *  (its quantity) and sale (whether a customer is attached). */
function matchesConditions(discount: Discount, lineQuantity: number, hasCustomer: boolean): boolean {
  if (discount.min_quantity != null && lineQuantity < discount.min_quantity) return false
  if (discount.requires_loyalty_customer && !hasCustomer) return false
  return true
}

/** Computes discount/tax/line totals for a cart, in one pass, reading the
 *  currently-active discounts/combo offers and each book's tax rate. Meant
 *  to be called from inside checkoutSale's transaction so pricing reflects
 *  the exact same database state the sale is committed against. */
export async function computeSalePricing(
  trx: Kysely<Database>,
  cartItems: CartItemInput[],
  at: Date = new Date(),
  customerId?: number
): Promise<SalePricing> {
  if (cartItems.length === 0) {
    return { items: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
  }
  const hasCustomer = customerId !== undefined

  const bookIds = cartItems.map((item) => item.bookId)
  const books = await trx
    .selectFrom('books')
    .select([
      'id',
      'category_id',
      'tax_rate_id',
      'unit_type',
      'selling_price',
      'secondary_unit_selling_price'
    ])
    .where('id', 'in', bookIds)
    .execute()
  const bookById = new Map(books.map((b) => [b.id, b]))

  const taxRates = await trx.selectFrom('tax_rates').selectAll().execute()
  const taxRateById = new Map(taxRates.map((t) => [t.id, t]))

  const atIso = at.toISOString()
  const discounts = await trx
    .selectFrom('discounts')
    .selectAll()
    .where('is_active', '=', 1)
    .where((eb) => eb.or([eb('starts_at', 'is', null), eb('starts_at', '<=', atIso)]))
    .where((eb) => eb.or([eb('ends_at', 'is', null), eb('ends_at', '>=', atIso)]))
    .execute()
  const comboOffers = await trx
    .selectFrom('combo_offers')
    .selectAll()
    .where('is_active', '=', 1)
    .where((eb) => eb.or([eb('starts_at', 'is', null), eb('starts_at', '<=', atIso)]))
    .where((eb) => eb.or([eb('ends_at', 'is', null), eb('ends_at', '>=', atIso)]))
    .execute()

  const items: PricedLineItem[] = []
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  for (const cartItem of cartItems) {
    const book = bookById.get(cartItem.bookId)
    const categoryId = book?.category_id ?? null
    const taxRate = book?.tax_rate_id != null ? taxRateById.get(book.tax_rate_id) : undefined

    // A manually-priced line (Discount Price in QtyModal) is the cashier's
    // deliberate final say on that line — automatic discount/combo rules
    // are skipped for it entirely rather than stacking on top, so the
    // receipt's manual Discount figure (price - unitPrice) * quantity stays
    // the whole story for that line, not a partial one. Tax still applies
    // normally either way.
    const skipAutomaticDiscounts = cartItem.priceOverridden === true

    // For an overridden line, cartItem.unitPrice is the cashier's *charged*
    // (already-discounted) price, not the book's list price — so gross
    // (which feeds the bill-level Subtotal, meant to be the pre-discount
    // sum) has to come from the book's own current default price instead,
    // same as the receipt's "Price" column resolves it (see
    // resolveUnitDefaultPriceByLabel's other caller in buildReceiptData).
    // A non-overridden line's unitPrice already *is* that default price, so
    // this is a no-op there.
    const listUnitPrice = skipAutomaticDiscounts
      ? resolveUnitDefaultPriceByLabel(
          {
            unit_type: book?.unit_type ?? 'qty',
            selling_price: book?.selling_price ?? cartItem.unitPrice,
            secondary_unit_selling_price: book?.secondary_unit_selling_price ?? null
          },
          cartItem.unitLabel ?? null
        )
      : cartItem.unitPrice
    const gross = listUnitPrice * cartItem.quantity

    const combo = skipAutomaticDiscounts ? undefined : findBestMatch<ComboOffer>(comboOffers, cartItem.bookId, categoryId)
    let comboFreeQty = 0
    if (combo) {
      const groupSize = combo.buy_quantity + combo.free_quantity
      if (groupSize > 0) {
        comboFreeQty = Math.floor(cartItem.quantity / groupSize) * combo.free_quantity
      }
    }
    const comboDiscount = comboFreeQty * cartItem.unitPrice

    const discountableAmount = gross - comboDiscount
    const eligibleDiscounts = skipAutomaticDiscounts
      ? []
      : discounts.filter((d) => matchesConditions(d, cartItem.quantity, hasCustomer))
    const discount = findBestMatch<Discount>(eligibleDiscounts, cartItem.bookId, categoryId)
    let promoDiscount = 0
    if (discount) {
      promoDiscount =
        discount.type === 'percent'
          ? discountableAmount * (discount.value / 100)
          : Math.min(discount.value * cartItem.quantity, discountableAmount)
    }

    // The manual override's own discount: gross (list price) minus what was
    // actually charged. comboDiscount/promoDiscount are always 0 here (both
    // are gated on skipAutomaticDiscounts above), so this never stacks with
    // them — it's the whole discountAmount for an overridden line, the same
    // way comboDiscount/promoDiscount are the whole story for a normal one.
    const manualDiscount = skipAutomaticDiscounts ? gross - cartItem.unitPrice * cartItem.quantity : 0

    const discountAmount = comboDiscount + promoDiscount + manualDiscount
    const netAmount = gross - discountAmount
    const taxAmount = taxRate && !taxRate.is_exempt ? netAmount * (taxRate.rate_percent / 100) : 0
    const lineTotal = netAmount + taxAmount

    subtotal += gross
    discountTotal += discountAmount
    taxTotal += taxAmount

    items.push({
      bookId: cartItem.bookId,
      quantity: cartItem.quantity,
      unitPrice: cartItem.unitPrice,
      discountAmount,
      taxAmount,
      lineTotal,
      unitLabel: cartItem.unitLabel ?? null,
      stockQuantity: cartItem.stockQuantity ?? cartItem.quantity,
      priceOverridden: cartItem.priceOverridden === true
    })
  }

  return { items, subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal }
}
