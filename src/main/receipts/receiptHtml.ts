import { RECEIPT_LABELS } from '../../shared/receiptLabels'
import { computeReceiptLinePricing } from '../../shared/receiptPricing'
import type { ReceiptData, ReceiptPaperSize } from '../../shared/sales'
import { SINHALA_FONT_BASE64 } from './sinhalaFontBase64'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(amount: number, language: 'en' | 'si'): string {
  return new Intl.NumberFormat(language === 'si' ? 'si-LK' : 'en-LK', {
    style: 'currency',
    currency: 'LKR'
  }).format(amount)
}

function formatDate(iso: string, language: 'en' | 'si'): string {
  return new Intl.DateTimeFormat(language === 'si' ? 'si-LK' : 'en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}

function formatDateOnly(iso: string, language: 'en' | 'si'): string {
  return new Intl.DateTimeFormat(language === 'si' ? 'si-LK' : 'en-LK', { dateStyle: 'medium' }).format(
    new Date(iso)
  )
}

/** '80mm' keeps the original narrow, roll-shaped layout; 'a4'/'a5' render
 *  as a normal full-page invoice — wider body, larger type, real margins —
 *  rather than just stretching the thermal layout across a full page.
 *
 *  Content width is deliberately narrower than the nominal 78mm usable
 *  width of an "80mm" roll — see RASTER_CONTENT_WIDTH_MM_80 below for why
 *  the exact value has to travel with this constant rather than being a
 *  bare number here. */
export const RASTER_CONTENT_WIDTH_MM_80 = 68

/** 58mm thermal paper's commonly-cited printable width is 48mm (384 dots
 *  at 203dpi — this is the figure printer vendors themselves publish for
 *  58mm-roll hardware, the 58mm equivalent of the "78mm nominal" figure
 *  the 80mm constant above started from). No real 58mm roll has been
 *  through the ruler-line calibration test yet (see RASTER_CONTENT_WIDTH_
 *  MM_80's comment for what that test is) — this printer has only ever
 *  been tested with 80mm paper loaded. Absent a real measurement, this
 *  applies the same ~87.2% safety ratio the ruler test found necessary
 *  for 80mm paper on this hardware (68mm measured-safe / 78mm nominal) to
 *  58mm's nominal 48mm, giving 48 * 0.872 ≈ 42mm. This is a reasoned
 *  estimate carried over from a different paper width, not a
 *  measurement — the same status paperWidthChars=32 already has for the
 *  text path (see printReceiptThermal's comment). Re-run the ruler test
 *  on real 58mm paper before trusting this number the way 68mm is now
 *  trusted. */
export const RASTER_CONTENT_WIDTH_MM_58 = 42

/** Single source of truth for which raster content width applies to which
 *  physical paper width — both the CSS body width (below) and the raster
 *  capture window in printReceipt.ts must read this instead of each
 *  picking their own constant, or they can drift apart exactly the way
 *  the original clipping bug happened (see RASTER_CONTENT_WIDTH_MM_80's
 *  comment). */
export function getRasterContentWidthMm(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? RASTER_CONTENT_WIDTH_MM_58 : RASTER_CONTENT_WIDTH_MM_80
}

/** The 78mm→68mm correction below (~87.5%, the same 42/48 ratio the
 *  ESC/POS TEXT path already established for this hardware — see
 *  printReceipt.ts's paperWidthChars comment) was applied once already
 *  (78mm nominal → 68mm CSS body width) and made *no visible difference*
 *  on a real print. Root cause of that non-fix: this CSS-only change
 *  narrows where the *content* sits inside the page, but printReceipt.ts's
 *  captureReceiptImage() was still asked to capture a window sized to the
 *  full nominal paper width (options.paperWidthMm, 80mm) — so the
 *  captured *raster image* handed to the printer stayed exactly as wide
 *  as before, just with the real content re-centered inside unused
 *  margin. Since the printer drops whatever falls past its physical
 *  print-head width by total image width, not by where the visible
 *  content happens to sit within that image, the same rightmost dots
 *  (this time genuinely blank margin as often as digits) got cut and the
 *  print looked identical. The two widths — the raster content width, and
 *  the capture window width in printReceipt.ts — must always be the same
 *  number for the correction to reach the actual bytes sent to the
 *  printer; `contentWidthMm` below is threaded through from
 *  getRasterContentWidthMm() so printReceipt.ts and this file always read
 *  the same value for whichever paper size is actually loaded, instead of
 *  each hardcoding its own copy that can drift out of sync the way the
 *  68mm-only CSS fix once did. Still a reasoned first pass for either
 *  paper width, not a fresh hardware measurement — if a real receipt
 *  still clips after this change, re-run the same ruler-line test used
 *  for paperWidthChars (print an unbroken horizontal black bar through
 *  this same raster path and see where it actually cuts off) and adjust
 *  RASTER_CONTENT_WIDTH_MM_80 / RASTER_CONTENT_WIDTH_MM_58 to match. */
function receiptStyle(paperSize: ReceiptPaperSize, contentWidthMm: number): string {
  if (paperSize === '80mm') {
    return `
  body { font-family: 'Noto Sans Sinhala', 'Segoe UI', sans-serif; width: ${contentWidthMm}mm; margin: 0 auto; padding: 4mm; font-size: 11px; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2mm; }
  .business-name { font-size: 13px; }
  .muted { color: #555; font-size: 10px; }
  .grand-total { font-weight: 700; font-size: 12px; }`
  }
  return `
  body { font-family: 'Noto Sans Sinhala', 'Segoe UI', sans-serif; width: 100%; max-width: 190mm; margin: 0 auto; padding: 18mm; font-size: 14px; color: #000; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 3mm; }
  .business-name { font-size: 18px; }
  .muted { color: #555; font-size: 12px; }
  .grand-total { font-weight: 700; font-size: 16px; }`
}

/** Builds a self-contained receipt HTML document (no external requests —
 *  the Sinhala font is embedded as base64 — so it renders identically
 *  offline in a hidden window regardless of dev vs. packaged build).
 *
 *  `contentWidthMm` only affects the '80mm' raster-style layout, and only
 *  matters to callers that also control the raster capture window width
 *  (i.e. printReceipt.ts) — see getRasterContentWidthMm above. It defaults
 *  to RASTER_CONTENT_WIDTH_MM_80 so PDF export (receiptPdf.ts), which has
 *  no capture window to keep in sync, keeps its existing fixed-width
 *  behavior unchanged. */
export function buildReceiptHtml(
  data: ReceiptData,
  paperSize: ReceiptPaperSize,
  rasterZoom?: number,
  contentWidthMm: number = RASTER_CONTENT_WIDTH_MM_80
): string {
  const t = RECEIPT_LABELS[data.language]
  const money = (n: number): string => formatMoney(n, data.language)
  const docLabel = data.documentType === 'quotation' ? t.quotationNo : t.invoiceNo

  // Per-line pricing (Price/Subtotal/Discount, see computeReceiptLinePricing)
  // is still computed here even though Section A (the item table) now only
  // shows Price — the per-line discount is summed below into the totals
  // block's single bill-level Discount figure instead of a per-line column.
  const linePricings = data.items.map((item) =>
    computeReceiptLinePricing(item.defaultUnitPrice, item.unitPrice, item.quantity)
  )
  // data.discountTotal already covers both a manual per-line override (see
  // computeSalePricing.ts) and whatever the automatic discount/combo engine
  // applied — it's the true total reduction on its own. linePricings above
  // is only for the per-line Price column; summing its .discount here too
  // would double-count every manually-discounted line.
  const totalDiscount = data.discountTotal

  const itemRows = data.items
    .map((item, i) => {
      const pricing = linePricings[i]
      return `
        <tr>
          <td class="item-title">${escapeHtml(item.title)}${item.isbn ? `<br/><span class="muted">${escapeHtml(item.isbn)}</span>` : ''}</td>
          <td class="num">${item.quantity}${item.unitLabel ? ` ${escapeHtml(item.unitLabel)}` : ''}</td>
          <td class="num">${money(pricing.price)}</td>
        </tr>`
    })
    .join('')

  const paymentRows = data.payments
    .map((p) => `<tr><td>${escapeHtml(p.method)}</td><td class="num">${money(p.amount)}</td></tr>`)
    .join('')

  return `<!doctype html>
<html lang="${data.language}">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Noto Sans Sinhala';
    src: url(data:font/woff2;base64,${SINHALA_FONT_BASE64}) format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  * { box-sizing: border-box; }
  ${receiptStyle(paperSize, contentWidthMm)}
  ${rasterZoom ? `body { zoom: ${rasterZoom}; }` : ''}
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  td, th { padding: 1mm 0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  .totals td { padding: 0.5mm 0; }
  .thank-you { text-align: center; margin-top: 3mm; }
</style>
</head>
<body>
  <div class="center business-name"><strong>${escapeHtml(data.businessName)}</strong></div>
  ${data.address ? `<div class="center muted">${escapeHtml(data.address)}</div>` : ''}
  ${data.phone || data.email ? `<div class="center muted">${[data.phone, data.email].filter(Boolean).map((v) => escapeHtml(v as string)).join(' · ')}</div>` : ''}

  <div class="rule"></div>

  <h1>${escapeHtml(docLabel)}: ${escapeHtml(data.invoiceNo)}</h1>
  ${data.documentType === 'quotation' ? `<div class="center muted">${escapeHtml(t.notTaxInvoice)}${data.validUntil ? ` — ${escapeHtml(t.validUntil)} ${formatDateOnly(data.validUntil, data.language)}` : ''}</div>` : ''}
  <div class="center muted">${escapeHtml(t.date)}: ${formatDate(data.saleDate, data.language)}</div>
  <div class="center muted">${escapeHtml(t.cashier)}: ${escapeHtml(data.cashierName)}</div>

  <div class="rule"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">${escapeHtml(t.item)}</th>
        <th class="num">${escapeHtml(t.qty)}</th>
        <th class="num">${escapeHtml(t.price)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="rule"></div>

  <table class="totals">
    <tr><td>${escapeHtml(t.subtotal)}</td><td class="num">${money(data.subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td>${escapeHtml(t.discount)}</td><td class="num">-${money(totalDiscount)}</td></tr>` : ''}
    ${data.taxTotal > 0 ? `<tr><td>${escapeHtml(t.tax)}</td><td class="num">${money(data.taxTotal)}</td></tr>` : ''}
    <tr class="grand-total"><td>${escapeHtml(t.grandTotal)}</td><td class="num">${money(data.total)}</td></tr>
  </table>

  ${
    data.documentType === 'quotation'
      ? ''
      : `<div class="rule"></div>

  <table>
    <thead><tr><th style="text-align:left">${escapeHtml(t.payment)}</th><th class="num"></th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <table class="totals">
    <tr><td>${escapeHtml(t.paid)}</td><td class="num">${money(data.amountPaid)}</td></tr>
    ${data.change > 0 ? `<tr><td>${escapeHtml(t.change)}</td><td class="num">${money(data.change)}</td></tr>` : ''}
    ${data.profit !== null ? `<tr><td>${escapeHtml(t.profit)}</td><td class="num">${money(data.profit)}</td></tr>` : ''}
  </table>`
  }

  <div class="thank-you">${escapeHtml(t.thankYou)}</div>
</body>
</html>`
}
