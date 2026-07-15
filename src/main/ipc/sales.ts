import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as sales from '../db/repositories/salesRepository'
import { getCurrentUserId } from '../auth/session'
import { getSetting } from '../db/repositories/settingsRepository'
import { buildReceiptData } from '../receipts/buildReceiptData'
import { renderReceiptPdf } from '../receipts/receiptPdf'
import { printReceiptThermal } from '../receipts/printReceipt'
import { ipcHandler } from './errors'
import type {
  CheckoutRequest,
  HoldSaleRequest,
  ReceiptData,
  ReceiptPaperSize,
  SaleSearchFilter
} from '../../shared/sales'
import type { ReceiptLanguage } from '../../shared/receiptLabels'

export function registerSalesIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'sales:hold',
    ipcHandler(async (input: HoldSaleRequest) => {
      const userId = getCurrentUserId()
      return sales.holdSale(db, {
        items: input.items,
        userId,
        customerId: input.customerId,
        notes: input.notes
      })
    })
  )

  ipcMain.handle(
    'sales:listHeld',
    ipcHandler(() => sales.listHeldSales(db))
  )

  ipcMain.handle(
    'sales:getWithItems',
    ipcHandler((saleId: number) => sales.getSaleWithItems(db, saleId))
  )

  ipcMain.handle(
    'sales:search',
    ipcHandler((filter: SaleSearchFilter = {}) => sales.searchSales(db, filter))
  )

  ipcMain.handle(
    'sales:checkout',
    ipcHandler(async (input: CheckoutRequest): Promise<ReceiptData> => {
      const userId = getCurrentUserId()
      const result = await sales.checkoutSale(db, {
        heldSaleId: input.heldSaleId,
        items: input.items,
        payments: input.payments,
        customerId: input.customerId,
        notes: input.notes,
        userId
      })
      return buildReceiptData(db, result.sale, result.items, result.payments, input.uiLanguage)
    })
  )

  ipcMain.handle(
    'sales:getReceiptData',
    ipcHandler(async (saleId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> => {
      const result = await sales.getSaleWithItems(db, saleId)
      if (!result) return undefined
      return buildReceiptData(db, result.sale, result.items, result.payments, uiLanguage)
    })
  )

  ipcMain.handle(
    'sales:exportReceiptPdf',
    ipcHandler(async (data: ReceiptData, paperSize?: ReceiptPaperSize): Promise<string | null> => {
      const pdfBuffer = await renderReceiptPdf(data, paperSize ?? '80mm')
      const focusedWindow = BrowserWindow.getFocusedWindow()
      const saveDialogOptions = {
        defaultPath: `${data.invoiceNo}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const result = focusedWindow
        ? await dialog.showSaveDialog(focusedWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions)
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, pdfBuffer)
      return result.filePath
    })
  )

  ipcMain.handle(
    'sales:printReceiptThermal',
    ipcHandler(async (data: ReceiptData): Promise<void> => {
      const interfaceName = (await getSetting(db, 'receipt.printerInterface')) ?? 'printer:AUTO'
      const paperWidthMm = Number((await getSetting(db, 'receipt.paperWidthMm')) ?? '80') as 58 | 80
      const drawerEnabled = (await getSetting(db, 'receipt.openDrawerOnCash')) === 'true'
      const hasCashPayment = data.payments.some((p) => p.method === 'cash')
      await printReceiptThermal(data, {
        interfaceName,
        paperWidthMm,
        openDrawer: drawerEnabled && hasCashPayment
      })
    })
  )
}
