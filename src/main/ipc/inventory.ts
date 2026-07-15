import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as books from '../db/repositories/booksRepository'
import * as categories from '../db/repositories/categoriesRepository'
import * as stock from '../db/repositories/stockRepository'
import * as stockTake from '../db/repositories/stockTakeRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type {
  AdjustStockRequest,
  BookFormInput,
  CreateBookFormInput,
  ListBooksFilter
} from '../../shared/inventory'

const MANAGE_ROLES = ['admin', 'manager'] as const

async function resolveCategoryId(
  db: Kysely<Database>,
  input: BookFormInput,
  userId: number | null
): Promise<number | null | undefined> {
  if (input.categoryName) {
    const category = await categories.findOrCreateCategoryByName(db, input.categoryName, userId)
    return category.id
  }
  return input.categoryId
}

export function registerInventoryIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'inventory:books:list',
    ipcHandler((filter: ListBooksFilter = {}) => books.listBooks(db, filter))
  )

  ipcMain.handle(
    'inventory:books:get',
    ipcHandler((id: number) => books.getBookById(db, id))
  )

  ipcMain.handle(
    'inventory:books:lowStock',
    ipcHandler(() => books.listLowStock(db))
  )

  ipcMain.handle(
    'inventory:books:create',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: CreateBookFormInput) => {
        const userId = getCurrentUserId()
        const categoryId = await resolveCategoryId(db, input, userId)
        return books.createBook(db, { ...input, categoryId, userId })
      })
    )
  )

  ipcMain.handle(
    'inventory:books:update',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (id: number, input: BookFormInput) => {
        const userId = getCurrentUserId()
        const categoryId = await resolveCategoryId(db, input, userId)
        return books.updateBook(db, id, { ...input, categoryId, userId })
      })
    )
  )

  ipcMain.handle(
    'inventory:books:setActive',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (id: number, isActive: boolean) => {
        const userId = getCurrentUserId()
        return books.setBookActive(db, id, isActive, userId)
      })
    )
  )

  ipcMain.handle(
    'inventory:categories:list',
    ipcHandler(() => categories.listCategories(db))
  )

  ipcMain.handle(
    'inventory:stock:adjust',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (input: AdjustStockRequest) => {
        const userId = getCurrentUserId()
        await stock.adjustStock(db, {
          bookId: input.bookId,
          changeQty: input.changeQty,
          movementType: input.reason,
          userId,
          notes: input.notes
        })
      })
    )
  )

  ipcMain.handle(
    'inventory:stock:history',
    ipcHandler((bookId: number) => stock.getMovementHistory(db, bookId))
  )

  ipcMain.handle(
    'inventory:stockTake:start',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (categoryId?: number) => {
        const userId = getCurrentUserId()
        return stockTake.startStockTake(db, userId, categoryId)
      })
    )
  )

  ipcMain.handle(
    'inventory:stockTake:current',
    ipcHandler(() => stockTake.getLatestInProgressStockTake(db))
  )

  ipcMain.handle(
    'inventory:stockTake:listItems',
    ipcHandler((stockTakeId: number) => stockTake.listStockTakeItems(db, stockTakeId))
  )

  ipcMain.handle(
    'inventory:stockTake:recordCount',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (itemId: number, countedQty: number) => {
        await stockTake.recordCount(db, itemId, countedQty)
      })
    )
  )

  ipcMain.handle(
    'inventory:stockTake:complete',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (stockTakeId: number) => {
        const userId = getCurrentUserId()
        return stockTake.completeStockTake(db, stockTakeId, userId)
      })
    )
  )
}
