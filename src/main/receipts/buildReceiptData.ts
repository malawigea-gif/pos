import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { getBusinessProfile, getSetting } from '../db/repositories/settingsRepository'
import {
  resolveReceiptLanguage,
  type ReceiptLanguage,
  type ReceiptLanguageSetting
} from '../../shared/receiptLabels'
import type { ReceiptData, Sale, SaleItemView, SalePayment } from '../../shared/sales'
import type { Quotation, QuotationItemView } from '../../shared/quotations'

export async function buildReceiptData(
  db: Kysely<Database>,
  sale: Sale,
  items: SaleItemView[],
  payments: SalePayment[],
  uiLanguage: ReceiptLanguage
): Promise<ReceiptData> {
  const cashier = await db
    .selectFrom('users')
    .select('full_name')
    .where('id', '=', sale.cashier_id)
    .executeTakeFirst()

  const settingValue = (await getSetting(db, 'receipt.language')) as ReceiptLanguageSetting | undefined
  const language = resolveReceiptLanguage(settingValue ?? 'match_ui', uiLanguage)
  const profile = await getBusinessProfile(db)

  return {
    saleId: sale.id,
    invoiceNo: sale.invoice_no,
    saleDate: sale.sale_date,
    cashierName: cashier?.full_name ?? '—',
    items: items.map((item) => ({
      title: item.book_title,
      isbn: item.book_isbn,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    })),
    subtotal: sale.subtotal,
    discountTotal: sale.discount_total,
    taxTotal: sale.tax_total,
    total: sale.total,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
    amountPaid: sale.amount_paid,
    change: Math.max(0, sale.amount_paid - sale.total),
    language,
    businessName: profile.businessName,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    documentType: 'invoice'
  }
}

export async function buildQuotationReceiptData(
  db: Kysely<Database>,
  quotation: Quotation,
  items: QuotationItemView[],
  uiLanguage: ReceiptLanguage
): Promise<ReceiptData> {
  const cashier = await db
    .selectFrom('users')
    .select('full_name')
    .where('id', '=', quotation.created_by)
    .executeTakeFirst()

  const settingValue = (await getSetting(db, 'receipt.language')) as ReceiptLanguageSetting | undefined
  const language = resolveReceiptLanguage(settingValue ?? 'match_ui', uiLanguage)
  const profile = await getBusinessProfile(db)

  return {
    saleId: quotation.id,
    invoiceNo: quotation.quote_no,
    saleDate: quotation.quote_date,
    cashierName: cashier?.full_name ?? '—',
    items: items.map((item) => ({
      title: item.book_title,
      isbn: item.book_isbn,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    })),
    subtotal: quotation.subtotal,
    discountTotal: quotation.discount_total,
    taxTotal: quotation.tax_total,
    total: quotation.total,
    payments: [],
    amountPaid: 0,
    change: 0,
    language,
    businessName: profile.businessName,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    documentType: 'quotation',
    validUntil: quotation.valid_until
  }
}
