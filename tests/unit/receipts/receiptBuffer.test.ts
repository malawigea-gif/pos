import { describe, expect, it } from 'vitest'
import { buildReceiptTextBuffer } from '../../../src/main/receipts/receiptBuffer'
import type { ReceiptData } from '../../../src/shared/sales'

function makeReceiptData(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    saleId: 1,
    invoiceNo: 'INV-2026-000042',
    saleDate: '2026-03-01T10:00:00.000Z',
    cashierName: 'Administrator',
    items: [
      { title: 'Clean Code', isbn: '9780132350884', quantity: 2, unitPrice: 1000, lineTotal: 2000, defaultUnitPrice: 1000 }
    ],
    subtotal: 2000,
    discountTotal: 0,
    taxTotal: 0,
    total: 2000,
    payments: [{ method: 'cash', amount: 2000 }],
    amountPaid: 2000,
    change: 0,
    language: 'en',
    businessName: 'My Shop',
    phone: null,
    email: null,
    address: null,
    documentType: 'invoice',
    profit: null,
    ...overrides
  }
}

describe('buildReceiptTextBuffer', () => {
  it('produces a non-empty ESC/POS buffer containing the invoice number, item title, per-line Price, and the bill Total', () => {
    const data = makeReceiptData()
    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })

    expect(buffer.length).toBeGreaterThan(0)
    const text = buffer.toString('latin1')
    expect(text).toContain(data.invoiceNo)
    expect(text).toContain('Clean Code')
    expect(text).toContain('1000.00') // Section A: per-line Price (defaultUnitPrice), not the line total
    expect(text).toContain('2000.00') // Section B: bill Subtotal/Total
  })

  // data.discountTotal is the sole source for the totals-block Discount
  // line — it already covers both manual per-line overrides and whatever
  // the automatic discount/combo engine applied (see computeSalePricing.ts),
  // so the render layer must not re-derive or add anything on top of it
  // (doing so for a manually-discounted line would double-count that
  // line's reduction — see the "Subtotal/Profit wrong on a bill with a
  // per-unit discount" bug report).
  it('shows data.discountTotal as the single Discount line, without re-summing per-line discounts on top', () => {
    const data = makeReceiptData({
      items: [
        // 100 -> 70: manual discount 30
        { title: 'Book A', isbn: null, quantity: 1, unitPrice: 70, lineTotal: 70, defaultUnitPrice: 100 },
        // 200 -> 150: manual discount 50
        { title: 'Book B', isbn: null, quantity: 1, unitPrice: 150, lineTotal: 150, defaultUnitPrice: 200 }
      ],
      subtotal: 300,
      discountTotal: 80, // 30 + 50 manual, already folded in by computeSalePricing
      total: 220,
      payments: [{ method: 'cash', amount: 220 }],
      amountPaid: 220
    })
    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })
    const lines = buffer.toString('latin1').split('\n')

    const discountLine = lines.find((line) => line.includes('Discount'))
    expect(discountLine).toBeDefined()
    expect(discountLine).toContain('80.00')
  })

  it('does not throw for a Sinhala-language receipt (content fidelity on real hardware is a separate, hardware-level concern)', () => {
    const data = makeReceiptData({
      language: 'si',
      cashierName: 'පරිපාලක',
      items: [
        { title: 'සිංහල පොත', isbn: null, quantity: 1, unitPrice: 500, lineTotal: 500, defaultUnitPrice: 500 }
      ],
      subtotal: 500,
      total: 500,
      payments: [{ method: 'cash', amount: 500 }],
      amountPaid: 500
    })

    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('includes a Profit line when profit is set (admin/manager viewing a sale)', () => {
    const data = makeReceiptData({ profit: 450 })
    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })
    expect(buffer.toString('latin1')).toContain('450.00')
  })

  it('omits the Profit line entirely when profit is null (cashier, or a quotation)', () => {
    const data = makeReceiptData({ profit: null })
    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })
    expect(buffer.toString('latin1')).not.toContain('Profit')
  })
})
