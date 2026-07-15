import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createCustomer } from '../../../src/main/db/repositories/customersRepository'
import {
  convertQuotationToSale,
  createQuotation,
  listQuotations,
  QuotationNotOpenError,
  voidQuotation
} from '../../../src/main/db/repositories/quotationsRepository'

describe('quotationsRepository', () => {
  it('creates a quotation without touching stock', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Exercise Book',
      costPrice: 50,
      sellingPrice: 100,
      initialStockQty: 20,
      userId: adminId
    })

    const quotation = await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 3, unitPrice: 100 }],
      userId: adminId
    })

    expect(quotation.status).toBe('open')
    expect(quotation.quote_no).toMatch(/^QUO-\d{4}-\d{6}$/)
    expect(quotation.subtotal).toBe(300)
    expect(quotation.total).toBe(300)

    const stock = await db.selectFrom('books').select('stock_qty').where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stock.stock_qty).toBe(20)

    const movements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('book_id', '=', book.id)
      .execute()
    // Only the initial-stock movement from createBook — none from the quotation.
    expect(movements).toHaveLength(1)
    expect(movements[0].reference_type).toBe('initial_stock')

    await db.destroy()
  })

  it('lists quotations filtered by status and by customer', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 10, sellingPrice: 20, userId: adminId })
    const customer = await createCustomer(db, { name: 'School Office', userId: adminId })

    const q1 = await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 20 }],
      customerId: customer.id,
      userId: adminId
    })
    await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 20 }],
      userId: adminId
    })
    await voidQuotation(db, q1.id, adminId)

    const open = await listQuotations(db, { status: 'open' })
    expect(open).toHaveLength(1)

    const forCustomer = await listQuotations(db, { customerId: customer.id })
    expect(forCustomer).toHaveLength(1)
    expect(forCustomer[0].id).toBe(q1.id)

    await db.destroy()
  })

  it('voids an open quotation, and rejects voiding an already-cancelled one', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, { title: 'Item', costPrice: 10, sellingPrice: 20, userId: adminId })
    const quotation = await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 1, unitPrice: 20 }],
      userId: adminId
    })

    const voided = await voidQuotation(db, quotation.id, adminId, 'Customer changed their mind')
    expect(voided.status).toBe('cancelled')

    await expect(voidQuotation(db, quotation.id, adminId)).rejects.toThrow(QuotationNotOpenError)

    await db.destroy()
  })

  it('converts an open quotation to a real sale, deducting stock exactly once', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Exercise Book',
      costPrice: 50,
      sellingPrice: 100,
      initialStockQty: 10,
      userId: adminId
    })
    const quotation = await createQuotation(db, {
      items: [{ bookId: book.id, quantity: 4, unitPrice: 100 }],
      userId: adminId
    })

    const stockBeforeConversion = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockBeforeConversion.stock_qty).toBe(10)

    const result = await convertQuotationToSale(db, quotation.id, [{ method: 'cash', amount: 400 }], adminId)

    expect(result.sale.status).toBe('completed')
    expect(result.sale.total).toBe(400)
    expect(result.items).toHaveLength(1)

    const stockAfterConversion = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterConversion.stock_qty).toBe(6)

    const updatedQuotation = await db
      .selectFrom('quotations')
      .selectAll()
      .where('id', '=', quotation.id)
      .executeTakeFirstOrThrow()
    expect(updatedQuotation.status).toBe('converted')

    // Converting the same quotation again must be rejected, not double-deduct stock.
    await expect(
      convertQuotationToSale(db, quotation.id, [{ method: 'cash', amount: 400 }], adminId)
    ).rejects.toThrow(QuotationNotOpenError)

    const stockAfterSecondAttempt = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterSecondAttempt.stock_qty).toBe(6)

    // A voided quotation can't be converted either.
    const anotherBook = await createBook(db, { title: 'Other', costPrice: 5, sellingPrice: 10, userId: adminId })
    const voidedQuotation = await createQuotation(db, {
      items: [{ bookId: anotherBook.id, quantity: 1, unitPrice: 10 }],
      userId: adminId
    })
    await voidQuotation(db, voidedQuotation.id, adminId)
    await expect(
      convertQuotationToSale(db, voidedQuotation.id, [{ method: 'cash', amount: 10 }], adminId)
    ).rejects.toThrow(QuotationNotOpenError)

    await db.destroy()
  })
})
