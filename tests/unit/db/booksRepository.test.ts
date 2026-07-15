import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import { createCategory } from '../../../src/main/db/repositories/categoriesRepository'
import {
  createBook,
  DuplicateBarcodeError,
  getBookByCode,
  listBooks,
  listLowStock,
  updateBook
} from '../../../src/main/db/repositories/booksRepository'

describe('booksRepository', () => {
  it('creates a book with initial stock recorded as a ledger movement', async () => {
    const { db, adminId } = await createTestDb()

    const book = await createBook(db, {
      title: 'The Hobbit',
      isbn: '9780261102217',
      costPrice: 500,
      sellingPrice: 950,
      initialStockQty: 10,
      userId: adminId
    })

    expect(book.stock_qty).toBe(10)

    const movements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('book_id', '=', book.id)
      .execute()
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ change_qty: 10, movement_type: 'adjustment' })

    const stored = await db.selectFrom('books').selectAll().where('id', '=', book.id).executeTakeFirstOrThrow()
    expect(stored.stock_qty).toBe(10)

    await db.destroy()
  })

  it('stores and updates the brand field, defaulting to null when omitted', async () => {
    const { db, adminId } = await createTestDb()

    const book = await createBook(db, {
      title: 'Graph Paper Notebook',
      brand: 'Atlas',
      costPrice: 50,
      sellingPrice: 100,
      userId: adminId
    })
    expect(book.brand).toBe('Atlas')

    const unbranded = await createBook(db, {
      title: 'Plain Notebook',
      costPrice: 50,
      sellingPrice: 100,
      userId: adminId
    })
    expect(unbranded.brand).toBeNull()

    const updated = await updateBook(db, unbranded.id, { brand: 'Everest', userId: adminId })
    expect(updated.brand).toBe('Everest')

    const auditRows = await db
      .selectFrom('audit_log')
      .selectAll()
      .where('entity_type', '=', 'books')
      .where('entity_id', '=', unbranded.id)
      .where('action', '=', 'update')
      .execute()
    expect(auditRows).toHaveLength(1)
    const changes = JSON.parse(auditRows[0].changes as string)
    expect(changes.brand).toEqual({ old: null, new: 'Everest' })

    await db.destroy()
  })

  it('applies the category default reorder level when none is given explicitly', async () => {
    const { db, adminId } = await createTestDb()
    const category = await createCategory(db, {
      name: 'Textbooks',
      defaultReorderLevel: 8,
      userId: adminId
    })

    const book = await createBook(db, {
      title: 'Advanced Mathematics',
      categoryId: category.id,
      costPrice: 300,
      sellingPrice: 600,
      userId: adminId
    })

    expect(book.reorder_level).toBe(8)

    await db.destroy()
  })

  it('finds a book by ISBN or internal barcode', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Sapiens',
      isbn: '9780062316097',
      barcode: 'BSP-001',
      costPrice: 800,
      sellingPrice: 1500,
      userId: adminId
    })

    expect((await getBookByCode(db, '9780062316097'))?.id).toBe(book.id)
    expect((await getBookByCode(db, 'BSP-001'))?.id).toBe(book.id)
    expect(await getBookByCode(db, 'does-not-exist')).toBeUndefined()

    await db.destroy()
  })

  it('rejects a duplicate barcode on create, but allows updating a book to keep its own barcode', async () => {
    const { db, adminId } = await createTestDb()
    const first = await createBook(db, {
      title: 'First Item',
      barcode: 'DUP-001',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })

    await expect(
      createBook(db, {
        title: 'Second Item',
        barcode: 'DUP-001',
        costPrice: 100,
        sellingPrice: 200,
        userId: adminId
      })
    ).rejects.toThrow(DuplicateBarcodeError)

    const second = await createBook(db, {
      title: 'Second Item',
      barcode: 'DUP-002',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })

    // Updating the second item to the first item's barcode should be rejected...
    await expect(
      updateBook(db, second.id, { barcode: 'DUP-001', userId: adminId })
    ).rejects.toThrow(DuplicateBarcodeError)

    // ...but updating the first item while keeping its own unchanged barcode must not throw.
    const updated = await updateBook(db, first.id, { barcode: 'DUP-001', title: 'First Item Renamed', userId: adminId })
    expect(updated.title).toBe('First Item Renamed')

    await db.destroy()
  })

  it('searches by title, author, isbn, and barcode', async () => {
    const { db, adminId } = await createTestDb()
    await createBook(db, {
      title: 'Clean Code',
      author: 'Robert Martin',
      isbn: '9780132350884',
      costPrice: 1000,
      sellingPrice: 2000,
      userId: adminId
    })
    await createBook(db, {
      title: 'Refactoring',
      author: 'Martin Fowler',
      costPrice: 1000,
      sellingPrice: 2000,
      userId: adminId
    })

    expect(await listBooks(db, { search: 'Clean' })).toHaveLength(1)
    expect(await listBooks(db, { search: 'Martin' })).toHaveLength(2)
    expect(await listBooks(db, { search: '9780132350884' })).toHaveLength(1)

    await db.destroy()
  })

  it('updateBook records a diff of only the changed fields', async () => {
    const { db, adminId } = await createTestDb()
    const book = await createBook(db, {
      title: 'Original Title',
      costPrice: 100,
      sellingPrice: 200,
      userId: adminId
    })

    await updateBook(db, book.id, { sellingPrice: 250, userId: adminId })

    const auditRows = await db
      .selectFrom('audit_log')
      .selectAll()
      .where('entity_type', '=', 'books')
      .where('entity_id', '=', book.id)
      .where('action', '=', 'update')
      .execute()

    expect(auditRows).toHaveLength(1)
    const changes = JSON.parse(auditRows[0].changes as string)
    expect(changes.selling_price).toEqual({ old: 200, new: 250 })
    expect(changes.title).toBeUndefined()

    await db.destroy()
  })

  it('lists books at or below their reorder level as low stock', async () => {
    const { db, adminId } = await createTestDb()
    await createBook(db, {
      title: 'Low Stock Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 2,
      reorderLevel: 5,
      userId: adminId
    })
    await createBook(db, {
      title: 'Well Stocked Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 50,
      reorderLevel: 5,
      userId: adminId
    })

    const lowStock = await listLowStock(db)
    expect(lowStock).toHaveLength(1)
    expect(lowStock[0].title).toBe('Low Stock Book')

    await db.destroy()
  })
})
