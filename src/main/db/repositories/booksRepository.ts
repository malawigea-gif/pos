import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'
import { adjustStockWithTrx } from './stockRepository'

export class DuplicateBarcodeError extends Error {
  constructor(
    public readonly barcode: string,
    public readonly existingBookId: number
  ) {
    super(`Barcode "${barcode}" is already used by another item`)
    this.name = 'DuplicateBarcodeError'
  }
}

export class DuplicateIsbnError extends Error {
  constructor(
    public readonly isbn: string,
    public readonly existingBookId: number
  ) {
    super(`ISBN "${isbn}" is already used by another item`)
    this.name = 'DuplicateIsbnError'
  }
}

export interface ListBooksOptions {
  search?: string
  categoryId?: number
  activeOnly?: boolean
}

export function listBooks(db: Kysely<Database>, options: ListBooksOptions = {}) {
  let query = db.selectFrom('books').selectAll()

  if (options.activeOnly !== false) {
    query = query.where('is_active', '=', 1)
  }
  if (options.categoryId !== undefined) {
    query = query.where('category_id', '=', options.categoryId)
  }
  if (options.search) {
    const term = `%${options.search}%`
    query = query.where((eb) =>
      eb.or([
        eb('title', 'like', term),
        eb('author', 'like', term),
        eb('isbn', 'like', term),
        eb('barcode', 'like', term)
      ])
    )
  }

  return query.orderBy('title').execute()
}

export function getBookById(db: Kysely<Database>, id: number) {
  return db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
}

/** Used by barcode-scan lookups: matches either the ISBN or the internally
 *  generated barcode, whichever the scanner emitted. */
export function getBookByCode(db: Kysely<Database>, code: string) {
  return db
    .selectFrom('books')
    .selectAll()
    .where((eb) => eb.or([eb('isbn', '=', code), eb('barcode', '=', code)]))
    .executeTakeFirst()
}

/** Checked before every insert/update so duplicates surface as a clean
 *  domain error rather than a raw SQLite UNIQUE-constraint exception. */
async function assertNoDuplicateCodes(
  trx: Kysely<Database>,
  values: { barcode?: string | null; isbn?: string | null },
  excludeId?: number
): Promise<void> {
  if (values.barcode) {
    let query = trx.selectFrom('books').select('id').where('barcode', '=', values.barcode)
    if (excludeId !== undefined) query = query.where('id', '!=', excludeId)
    const existing = await query.executeTakeFirst()
    if (existing) throw new DuplicateBarcodeError(values.barcode, existing.id)
  }
  if (values.isbn) {
    let query = trx.selectFrom('books').select('id').where('isbn', '=', values.isbn)
    if (excludeId !== undefined) query = query.where('id', '!=', excludeId)
    const existing = await query.executeTakeFirst()
    if (existing) throw new DuplicateIsbnError(values.isbn, existing.id)
  }
}

export function listLowStock(db: Kysely<Database>) {
  return db
    .selectFrom('books')
    .selectAll()
    .where('is_active', '=', 1)
    .whereRef('stock_qty', '<=', 'reorder_level')
    .orderBy('title')
    .execute()
}

export interface CreateBookInput {
  isbn?: string | null
  barcode?: string | null
  title: string
  author?: string | null
  publisher?: string | null
  brand?: string | null
  categoryId?: number | null
  language?: string | null
  taxRateId?: number | null
  costPrice: number
  sellingPrice: number
  initialStockQty?: number
  reorderLevel?: number
  shelfLocation?: string | null
  userId: number | null
}

export async function createBook(db: Kysely<Database>, input: CreateBookInput) {
  return db.transaction().execute(async (trx) => {
    let reorderLevel = input.reorderLevel
    if (reorderLevel === undefined && input.categoryId != null) {
      const category = await trx
        .selectFrom('categories')
        .select('default_reorder_level')
        .where('id', '=', input.categoryId)
        .executeTakeFirst()
      reorderLevel = category?.default_reorder_level ?? 0
    }

    let taxRateId = input.taxRateId
    if (taxRateId === undefined) {
      const defaultTaxRate = await trx
        .selectFrom('tax_rates')
        .select('id')
        .where('is_default', '=', 1)
        .executeTakeFirst()
      taxRateId = defaultTaxRate?.id ?? null
    }

    await assertNoDuplicateCodes(trx, { barcode: input.barcode, isbn: input.isbn })

    const book = await trx
      .insertInto('books')
      .values({
        isbn: input.isbn ?? null,
        barcode: input.barcode ?? null,
        title: input.title,
        author: input.author ?? null,
        publisher: input.publisher ?? null,
        brand: input.brand ?? null,
        category_id: input.categoryId ?? null,
        language: input.language ?? null,
        tax_rate_id: taxRateId,
        cost_price: input.costPrice,
        selling_price: input.sellingPrice,
        stock_qty: 0,
        reorder_level: reorderLevel ?? 0,
        shelf_location: input.shelfLocation ?? null,
        is_active: 1
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'books',
      entityId: book.id,
      after: { title: book.title, isbn: book.isbn, selling_price: book.selling_price }
    })

    const initialQty = input.initialStockQty ?? 0
    if (initialQty > 0) {
      await adjustStockWithTrx(trx, {
        bookId: book.id,
        changeQty: initialQty,
        movementType: 'adjustment',
        referenceType: 'initial_stock',
        userId: input.userId,
        notes: 'Initial stock on catalog creation'
      })
      return { ...book, stock_qty: initialQty }
    }

    return book
  })
}

export interface UpdateBookInput {
  isbn?: string | null
  barcode?: string | null
  title?: string
  author?: string | null
  publisher?: string | null
  brand?: string | null
  categoryId?: number | null
  language?: string | null
  taxRateId?: number | null
  costPrice?: number
  sellingPrice?: number
  reorderLevel?: number
  shelfLocation?: string | null
  userId: number | null
}

export async function updateBook(db: Kysely<Database>, id: number, input: UpdateBookInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirstOrThrow()

    await assertNoDuplicateCodes(trx, { barcode: input.barcode, isbn: input.isbn }, id)

    const after = await trx
      .updateTable('books')
      .set({
        ...(input.isbn !== undefined && { isbn: input.isbn }),
        ...(input.barcode !== undefined && { barcode: input.barcode }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.author !== undefined && { author: input.author }),
        ...(input.publisher !== undefined && { publisher: input.publisher }),
        ...(input.brand !== undefined && { brand: input.brand }),
        ...(input.categoryId !== undefined && { category_id: input.categoryId }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.taxRateId !== undefined && { tax_rate_id: input.taxRateId }),
        ...(input.costPrice !== undefined && { cost_price: input.costPrice }),
        ...(input.sellingPrice !== undefined && { selling_price: input.sellingPrice }),
        ...(input.reorderLevel !== undefined && { reorder_level: input.reorderLevel }),
        ...(input.shelfLocation !== undefined && { shelf_location: input.shelfLocation }),
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'books',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export async function setBookActive(
  db: Kysely<Database>,
  id: number,
  isActive: boolean,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('books')
      .set({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'books',
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: after.is_active }
    })

    return after
  })
}
