import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
import { RECEIPT_LABELS } from '../../shared/receiptLabels'
import { computeReceiptLinePricing } from '../../shared/receiptPricing'
import type { ReceiptData } from '../../shared/sales'

export interface BuildThermalBufferOptions {
  interfaceName: string
  paperWidthChars?: number
}

/** Builds the plain-text ESC/POS byte buffer for a receipt — pure
 *  computation, no device I/O, so it's unit-testable without hardware.
 *
 *  Caveat: this only renders correctly for Latin-script (English) content.
 *  Commodity ESC/POS thermal printers only support the manufacturer's
 *  built-in 8-bit code pages, none of which include Sinhala glyphs, so a
 *  Sinhala receipt sent this way would print as mojibake on real hardware —
 *  see printReceiptThermal, which rasterizes Sinhala receipts to an image
 *  instead of using this text path. */
export function buildReceiptTextBuffer(data: ReceiptData, options: BuildThermalBufferOptions): Buffer {
  const t = RECEIPT_LABELS[data.language]
  const docLabel = data.documentType === 'quotation' ? t.quotationNo : t.invoiceNo
  // 42, not the commonly-cited 48 — see printReceiptThermal for how this
  // was confirmed against real 80mm hardware.
  const paperWidthChars = options.paperWidthChars ?? 42
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    // Pure buffer-building — getBuffer() is called below, never execute(),
    // so no real interface is needed. An object short-circuits
    // node-thermal-printer's interface-string parsing (which would
    // otherwise try to load a printer driver for e.g. `printer:AUTO`).
    // The library's own JS accepts an object here; only its .d.ts narrows
    // this to `string` (see printReceipt.ts for the same cast).
    interface: {} as unknown as string,
    width: paperWidthChars,
    removeSpecialCharacters: false
  })

  printer.alignCenter()
  printer.bold(true)
  printer.println(data.businessName)
  printer.bold(false)
  if (data.address) printer.println(data.address)
  if (data.phone || data.email) printer.println([data.phone, data.email].filter(Boolean).join(' · '))
  printer.drawLine()

  printer.alignCenter()
  printer.bold(true)
  printer.println(`${docLabel}: ${data.invoiceNo}`)
  printer.bold(false)
  if (data.documentType === 'quotation') {
    printer.println(
      data.validUntil
        ? `${t.notTaxInvoice} — ${t.validUntil} ${new Date(data.validUntil).toLocaleDateString()}`
        : t.notTaxInvoice
    )
  }
  printer.println(new Date(data.saleDate).toLocaleString())
  printer.println(`${t.cashier}: ${data.cashierName}`)
  printer.drawLine()

  // tableCustom's `width` option is a fraction of the printer's configured
  // width, and it ceils each fractional cell independently rather than
  // rounding the row as a whole — e.g. at width 42 with 0.55/0.15/0.3,
  // cells come out to ceil(23.1)+ceil(6.3)+ceil(12.6) = 24+7+13 = 44
  // characters, two over budget, on *every* row regardless of content.
  // The printer's own hardware then wraps that overshoot mid-row (seen on
  // real hardware as the total splitting mid-number, e.g. "80." / "00").
  // Passing exact integer `cols` that are pre-computed to sum to the real
  // width sidesteps the ceiling entirely.
  const qtyCols = Math.round(paperWidthChars * 0.15)
  const totalCols = Math.round(paperWidthChars * 0.3)
  const titleCols = paperWidthChars - qtyCols - totalCols

  // Section A (the item table) only shows Item/Qty/Price — Subtotal and
  // Discount stay per-line concepts computed here, but only their sum
  // (across every line, plus whatever the automatic discount/combo engine
  // separately applied) is shown, as a single bill-level Discount line in
  // the totals section below, not per item.
  const linePricings = data.items.map((item) =>
    computeReceiptLinePricing(item.defaultUnitPrice, item.unitPrice, item.quantity)
  )
  printer.alignLeft()
  data.items.forEach((item, i) => {
    printer.tableCustom([
      { text: item.title, align: 'LEFT', cols: titleCols },
      { text: String(item.quantity), align: 'RIGHT', cols: qtyCols },
      { text: linePricings[i].price.toFixed(2), align: 'RIGHT', cols: totalCols }
    ])
  })
  printer.drawLine()

  // data.discountTotal already covers both a manual per-line override (see
  // computeSalePricing.ts) and whatever the automatic discount/combo engine
  // applied — it's the true total reduction on its own. linePricings above
  // is only for the per-line Price column; summing its .discount here too
  // would double-count every manually-discounted line.
  const totalDiscount = data.discountTotal

  printer.leftRight(t.subtotal, data.subtotal.toFixed(2))
  if (totalDiscount > 0) printer.leftRight(t.discount, `-${totalDiscount.toFixed(2)}`)
  if (data.taxTotal > 0) printer.leftRight(t.tax, data.taxTotal.toFixed(2))
  printer.bold(true)
  printer.leftRight(t.grandTotal, data.total.toFixed(2))
  printer.bold(false)
  printer.drawLine()

  if (data.documentType !== 'quotation') {
    for (const payment of data.payments) {
      printer.leftRight(payment.method, payment.amount.toFixed(2))
    }
    printer.leftRight(t.paid, data.amountPaid.toFixed(2))
    if (data.change > 0) printer.leftRight(t.change, data.change.toFixed(2))
    if (data.profit !== null) printer.leftRight(t.profit, data.profit.toFixed(2))
  }

  printer.newLine()
  printer.alignCenter()
  printer.println(t.thankYou)

  return printer.getBuffer()
}
