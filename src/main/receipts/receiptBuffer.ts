import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
import { RECEIPT_LABELS } from '../../shared/receiptLabels'
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
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: options.interfaceName,
    width: options.paperWidthChars ?? 48,
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

  printer.alignLeft()
  for (const item of data.items) {
    printer.tableCustom([
      { text: item.title, align: 'LEFT', width: 0.55 },
      { text: String(item.quantity), align: 'RIGHT', width: 0.15 },
      { text: item.lineTotal.toFixed(2), align: 'RIGHT', width: 0.3 }
    ])
  }
  printer.drawLine()

  printer.leftRight(t.subtotal, data.subtotal.toFixed(2))
  if (data.discountTotal > 0) printer.leftRight(t.discount, `-${data.discountTotal.toFixed(2)}`)
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
  }

  printer.newLine()
  printer.alignCenter()
  printer.println(t.thankYou)

  return printer.getBuffer()
}
