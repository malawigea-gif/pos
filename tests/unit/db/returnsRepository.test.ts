import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createBook } from '../../../src/main/db/repositories/booksRepository'
import { createCustomer } from '../../../src/main/db/repositories/customersRepository'
import { checkoutSale } from '../../../src/main/db/repositories/salesRepository'
import {
  approveReturn,
  createReturn,
  getReturnableSaleItems,
  rejectReturn,
  ReturnQuantityExceedsAvailableError,
  setApprovalThreshold
} from '../../../src/main/db/repositories/returnsRepository'

describe('returnsRepository', () => {
  it('computes a full refund and adds stock back automatically when below the approval threshold', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 100000, adminId) // effectively no approval needed
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 500,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 1000 }],
      userId: adminId
    })

    const stockAfterSale = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterSale.stock_qty).toBe(8)

    const saleItemId = sale.items[0].id
    const ret = await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 2 }],
      userId: adminId
    })

    expect(ret.status).toBe('completed')
    expect(ret.refund_total).toBe(1000)
    expect(ret.return_no).toMatch(/^RET-\d{4}-\d{6}$/)

    const stockAfterReturn = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockAfterReturn.stock_qty).toBe(10)

    const updatedSale = await db
      .selectFrom('sales')
      .select('status')
      .where('id', '=', sale.sale.id)
      .executeTakeFirstOrThrow()
    expect(updatedSale.status).toBe('returned')

    await db.destroy()
  })

  it('computes a partial refund proportional to the line total (including any discount/tax already applied)', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 100000, adminId)
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 4, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 1200 }],
      userId: adminId
    })
    const saleItemId = sale.items[0].id

    const ret = await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 1 }], // return 1 of 4
      userId: adminId
    })

    expect(ret.refund_total).toBe(300) // 1200 line_total / 4 qty * 1
    expect(ret.status).toBe('completed')

    const updatedSale = await db
      .selectFrom('sales')
      .select('status')
      .where('id', '=', sale.sale.id)
      .executeTakeFirstOrThrow()
    expect(updatedSale.status).toBe('partially_returned')

    await db.destroy()
  })

  it('rejects returning more than was purchased', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 600 }],
      userId: adminId
    })
    const saleItemId = sale.items[0].id

    await expect(
      createReturn(db, { saleId: sale.sale.id, items: [{ saleItemId, quantity: 3 }], userId: adminId })
    ).rejects.toBeInstanceOf(ReturnQuantityExceedsAvailableError)

    await db.destroy()
  })

  it('a pending-approval return reserves its units so a second return cannot double-claim them', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 0, adminId) // everything needs approval
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 600 }],
      userId: adminId
    })
    const saleItemId = sale.items[0].id

    const firstReturn = await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 2 }],
      userId: adminId
    })
    expect(firstReturn.status).toBe('pending_approval')

    // Stock must NOT have moved yet — nothing is applied until approved.
    const stockWhilePending = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stockWhilePending.stock_qty).toBe(8)

    await expect(
      createReturn(db, { saleId: sale.sale.id, items: [{ saleItemId, quantity: 1 }], userId: adminId })
    ).rejects.toBeInstanceOf(ReturnQuantityExceedsAvailableError)

    const info = await getReturnableSaleItems(db, sale.sale.id)
    expect(info?.items[0].returnable).toBe(0)
    expect(info?.items[0].alreadyClaimed).toBe(2)

    await db.destroy()
  })

  it('approving a pending return applies stock and sale status changes', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 0, adminId)
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 600 }],
      userId: adminId
    })
    const saleItemId = sale.items[0].id

    const pending = await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 2 }],
      userId: adminId
    })

    const approved = await approveReturn(db, pending.id, adminId)
    expect(approved.status).toBe('completed')
    expect(approved.approved_by).toBe(adminId)

    const stock = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stock.stock_qty).toBe(10)

    const updatedSale = await db
      .selectFrom('sales')
      .select('status')
      .where('id', '=', sale.sale.id)
      .executeTakeFirstOrThrow()
    expect(updatedSale.status).toBe('returned')

    await db.destroy()
  })

  it('rejecting a pending return leaves stock and sale status untouched, and frees the units', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 0, adminId)
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 300,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 300 }],
      payments: [{ method: 'cash', amount: 600 }],
      userId: adminId
    })
    const saleItemId = sale.items[0].id

    const pending = await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 2 }],
      userId: adminId
    })

    const rejected = await rejectReturn(db, pending.id, adminId, 'Item was not actually damaged')
    expect(rejected.status).toBe('rejected')

    const stock = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(stock.stock_qty).toBe(8) // unchanged

    const updatedSale = await db
      .selectFrom('sales')
      .select('status')
      .where('id', '=', sale.sale.id)
      .executeTakeFirstOrThrow()
    expect(updatedSale.status).toBe('completed') // unchanged

    // units are free again since the rejected return no longer claims them
    const info = await getReturnableSaleItems(db, sale.sale.id)
    expect(info?.items[0].returnable).toBe(2)

    await db.destroy()
  })

  it('claws back the customer credit balance when the original sale was paid entirely on credit', async () => {
    const { db, adminId } = await createTestDb()
    await setApprovalThreshold(db, 100000, adminId)
    const customer = await createCustomer(db, {
      name: 'School',
      isCreditAccount: true,
      creditLimit: 50000,
      userId: adminId
    })
    const book = await createBook(db, {
      title: 'Book',
      costPrice: 100,
      sellingPrice: 1000,
      initialStockQty: 10,
      userId: adminId
    })
    const sale = await checkoutSale(db, {
      items: [{ bookId: book.id, quantity: 2, unitPrice: 1000 }],
      payments: [{ method: 'credit', amount: 2000 }],
      customerId: customer.id,
      userId: adminId
    })

    const customerAfterSale = await db
      .selectFrom('customers')
      .select('credit_balance')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(customerAfterSale.credit_balance).toBe(2000)

    const saleItemId = sale.items[0].id
    await createReturn(db, {
      saleId: sale.sale.id,
      items: [{ saleItemId, quantity: 1 }],
      userId: adminId
    })

    const customerAfterReturn = await db
      .selectFrom('customers')
      .select('credit_balance')
      .where('id', '=', customer.id)
      .executeTakeFirstOrThrow()
    expect(customerAfterReturn.credit_balance).toBe(1000)

    await db.destroy()
  })
})
