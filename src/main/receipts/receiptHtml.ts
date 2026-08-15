import { RECEIPT_LABELS } from '../../shared/receiptLabels'
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
 *  rather than just stretching the thermal layout across a full page. */
function receiptStyle(paperSize: ReceiptPaperSize): string {
  if (paperSize === '80mm') {
    return `
  body { font-family: 'Noto Sans Sinhala', 'Segoe UI', sans-serif; width: 78mm; margin: 0 auto; padding: 4mm; font-size: 11px; color: #000; }
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
 *  offline in a hidden window regardless of dev vs. packaged build). */
export function buildReceiptHtml(data: ReceiptData, paperSize: ReceiptPaperSize, rasterZoom?: number): string {
  const t = RECEIPT_LABELS[data.language]
  const money = (n: number): string => formatMoney(n, data.language)
  const docLabel = data.documentType === 'quotation' ? t.quotationNo : t.invoiceNo

  const itemRows = data.items
    .map(
      (item) => `
        <tr>
          <td class="item-title">${escapeHtml(item.title)}${item.isbn ? `<br/><span class="muted">${escapeHtml(item.isbn)}</span>` : ''}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.unitPrice)}</td>
          <td class="num">${money(item.lineTotal)}</td>
        </tr>`
    )
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
  ${receiptStyle(paperSize)}
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
        <th class="num">${escapeHtml(t.lineTotal)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="rule"></div>

  <table class="totals">
    <tr><td>${escapeHtml(t.subtotal)}</td><td class="num">${money(data.subtotal)}</td></tr>
    ${data.discountTotal > 0 ? `<tr><td>${escapeHtml(t.discount)}</td><td class="num">-${money(data.discountTotal)}</td></tr>` : ''}
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
  </table>`
  }

  <div class="thank-you">${escapeHtml(t.thankYou)}</div>
</body>
</html>`
}
