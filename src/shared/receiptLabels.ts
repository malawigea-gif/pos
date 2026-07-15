// Receipt text is governed by a separate "receipt language" setting, not the
// active UI language (a shop may want receipts always in Sinhala regardless
// of which language the cashier runs the UI in) — so these labels are looked
// up directly rather than through react-i18next, and this file is imported
// from both the main process (thermal/PDF generation) and the renderer
// (on-screen receipt view).
export type ReceiptLanguage = 'en' | 'si'
export type ReceiptLanguageSetting = ReceiptLanguage | 'match_ui'

export const RECEIPT_LABELS: Record<ReceiptLanguage, Record<string, string>> = {
  en: {
    invoiceNo: 'Invoice No',
    quotationNo: 'Quotation No',
    notTaxInvoice: 'This is a price quotation, not a tax invoice',
    validUntil: 'valid until',
    date: 'Date',
    cashier: 'Cashier',
    item: 'Item',
    qty: 'Qty',
    price: 'Price',
    lineTotal: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    grandTotal: 'Grand Total',
    payment: 'Payment',
    paid: 'Paid',
    change: 'Change',
    thankYou: 'Thank you for your purchase!'
  },
  si: {
    invoiceNo: 'ඉන්වොයිස් අංකය',
    quotationNo: 'මිල ගණන් අංකය',
    notTaxInvoice: 'මෙය මිල ගණනයක් මිස බදු ඉන්වොයිසියක් නොවේ',
    validUntil: 'දක්වා වලංගුය',
    date: 'දිනය',
    cashier: 'මුදල් අයකැමි',
    item: 'අයිතමය',
    qty: 'ප්‍රමාණය',
    price: 'මිල',
    lineTotal: 'එකතුව',
    subtotal: 'උප එකතුව',
    discount: 'වට්ටම',
    tax: 'බදු',
    grandTotal: 'මුළු එකතුව',
    payment: 'ගෙවීම',
    paid: 'ගෙවූ මුදල',
    change: 'ඉතිරි මුදල',
    thankYou: 'ඔබගේ මිලදී ගැනීමට ස්තූතියි!'
  }
}

export function resolveReceiptLanguage(
  setting: ReceiptLanguageSetting,
  uiLanguage: ReceiptLanguage
): ReceiptLanguage {
  return setting === 'match_ui' ? uiLanguage : setting
}
