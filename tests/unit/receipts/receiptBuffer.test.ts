import { describe, expect, it } from 'vitest'
import { buildReceiptTextBuffer } from '../../../src/main/receipts/receiptBuffer'
import type { ReceiptData } from '../../../src/shared/sales'

function makeReceiptData(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    saleId: 1,
    invoiceNo: 'INV-2026-000042',
    saleDate: '2026-03-01T10:00:00.000Z',
    cashierName: 'Administrator',
    items: [{ title: 'Clean Code', isbn: '9780132350884', quantity: 2, unitPrice: 1000, lineTotal: 2000 }],
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
    ...overrides
  }
}

describe('buildReceiptTextBuffer', () => {
  it('produces a non-empty ESC/POS buffer containing the invoice number and item title for an English receipt', () => {
    const data = makeReceiptData()
    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })

    expect(buffer.length).toBeGreaterThan(0)
    const text = buffer.toString('latin1')
    expect(text).toContain(data.invoiceNo)
    expect(text).toContain('Clean Code')
    expect(text).toContain('2000.00')
  })

  it('does not throw for a Sinhala-language receipt (content fidelity on real hardware is a separate, hardware-level concern)', () => {
    const data = makeReceiptData({
      language: 'si',
      cashierName: 'පරිපාලක',
      items: [{ title: 'සිංහල පොත', isbn: null, quantity: 1, unitPrice: 500, lineTotal: 500 }],
      subtotal: 500,
      total: 500,
      payments: [{ method: 'cash', amount: 500 }],
      amountPaid: 500
    })

    const buffer = buildReceiptTextBuffer(data, { interfaceName: 'tcp://127.0.0.1:9100' })
    expect(buffer.length).toBeGreaterThan(0)
  })
})
