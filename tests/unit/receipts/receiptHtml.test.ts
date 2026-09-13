import { describe, expect, it } from 'vitest'
import { buildReceiptHtml } from '../../../src/main/receipts/receiptHtml'
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

describe('buildReceiptHtml — Section A (item table)', () => {
  it('has exactly Item/Qty/Price columns — no Subtotal, Discount, or line Total', () => {
    const html = buildReceiptHtml(makeReceiptData(), '80mm')
    const [, headerRow] = html.match(/<thead>([\s\S]*?)<\/thead>/) ?? []
    expect(headerRow).toBeDefined()
    const headerCells = headerRow!.match(/<th/g) ?? []
    expect(headerCells).toHaveLength(3) // Item, Qty, Price

    const [, itemRow] = html.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/) ?? []
    expect(itemRow).toBeDefined()
    const numCells = itemRow!.match(/<td class="num">/g) ?? []
    expect(numCells).toHaveLength(2) // Qty, Price — not Subtotal/Discount/Total
  })

  it('shows the item\'s default price, not the discounted charged price', () => {
    const html = buildReceiptHtml(
      makeReceiptData({
        items: [{ title: 'Discounted Book', isbn: null, quantity: 1, unitPrice: 70, lineTotal: 70, defaultUnitPrice: 100 }]
      }),
      '80mm'
    )
    const [, itemRow] = html.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/) ?? []
    expect(itemRow).toContain('100.00')
    expect(itemRow).not.toContain('70.00')
  })
})

describe('buildReceiptHtml — Section B (totals block)', () => {
  // data.discountTotal is the sole source for the Discount row — it already
  // covers both manual per-line overrides and whatever the automatic
  // discount/combo engine applied (see computeSalePricing.ts), so the
  // render layer must not re-derive or add anything on top of it (doing so
  // for a manually-discounted line would double-count that line's
  // reduction — see the "Subtotal/Profit wrong on a bill with a per-unit
  // discount" bug report).
  it('shows data.discountTotal as the single Discount row, without re-summing per-line discounts on top', () => {
    const html = buildReceiptHtml(
      makeReceiptData({
        items: [
          { title: 'Book A', isbn: null, quantity: 1, unitPrice: 70, lineTotal: 70, defaultUnitPrice: 100 }, // manual 30
          { title: 'Book B', isbn: null, quantity: 1, unitPrice: 150, lineTotal: 150, defaultUnitPrice: 200 } // manual 50
        ],
        subtotal: 300,
        discountTotal: 95, // 30 + 50 manual, already folded in by computeSalePricing
        total: 205
      }),
      '80mm'
    )
    const [, totalsBlock] = html.match(/<table class="totals">([\s\S]*?)<\/table>/) ?? []
    expect(totalsBlock).toBeDefined()
    expect(totalsBlock).toContain('95.00')
    expect(totalsBlock).not.toContain('Profit')
  })

  it('omits the Discount row entirely when there is no discount at all', () => {
    const html = buildReceiptHtml(makeReceiptData(), '80mm')
    const [, totalsBlock] = html.match(/<table class="totals">([\s\S]*?)<\/table>/) ?? []
    expect(totalsBlock).not.toContain('Discount')
  })
})

describe('buildReceiptHtml — Section C (payment block)', () => {
  it('shows Profit alongside Paid/Change, not in the totals block', () => {
    const html = buildReceiptHtml(makeReceiptData({ profit: 450, change: 50, amountPaid: 2050 }), '80mm')

    const totalsBlocks = [...html.matchAll(/<table class="totals">([\s\S]*?)<\/table>/g)]
    expect(totalsBlocks).toHaveLength(2) // Section B totals, then Section C payment totals
    expect(totalsBlocks[0][1]).not.toContain('Profit')
    expect(totalsBlocks[1][1]).toContain('Profit')
    expect(totalsBlocks[1][1]).toContain('450.00')
  })

  it('omits Profit entirely when null (cashier, or a quotation)', () => {
    const html = buildReceiptHtml(makeReceiptData({ profit: null }), '80mm')
    expect(html).not.toContain('Profit')
  })
})
