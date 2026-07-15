import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as quotations from '../db/repositories/quotationsRepository'
import { getCurrentUserId } from '../auth/session'
import { buildQuotationReceiptData, buildReceiptData } from '../receipts/buildReceiptData'
import { ipcHandler } from './errors'
import type {
  ConvertQuotationRequest,
  CreateQuotationRequest,
  ListQuotationsFilter,
  Quotation
} from '../../shared/quotations'
import type { ReceiptData } from '../../shared/sales'
import type { ReceiptLanguage } from '../../shared/receiptLabels'

export function registerQuotationsIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'quotations:create',
    ipcHandler(async (input: CreateQuotationRequest): Promise<Quotation> => {
      const userId = getCurrentUserId()
      return quotations.createQuotation(db, {
        items: input.items,
        customerId: input.customerId,
        validUntil: input.validUntil,
        notes: input.notes,
        userId
      })
    })
  )

  ipcMain.handle(
    'quotations:list',
    ipcHandler((filter: ListQuotationsFilter = {}) => quotations.listQuotations(db, filter))
  )

  ipcMain.handle(
    'quotations:get',
    ipcHandler((quotationId: number) => quotations.getQuotationWithItems(db, quotationId))
  )

  ipcMain.handle(
    'quotations:getReceiptData',
    ipcHandler(async (quotationId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> => {
      const result = await quotations.getQuotationWithItems(db, quotationId)
      if (!result) return undefined
      return buildQuotationReceiptData(db, result.quotation, result.items, uiLanguage)
    })
  )

  ipcMain.handle(
    'quotations:void',
    ipcHandler(async (quotationId: number, reason?: string): Promise<Quotation> => {
      const userId = getCurrentUserId()
      return quotations.voidQuotation(db, quotationId, userId, reason)
    })
  )

  ipcMain.handle(
    'quotations:convertToSale',
    ipcHandler(
      async (
        quotationId: number,
        input: ConvertQuotationRequest,
        uiLanguage: ReceiptLanguage
      ): Promise<ReceiptData> => {
        const userId = getCurrentUserId()
        const result = await quotations.convertQuotationToSale(db, quotationId, input.payments, userId)
        return buildReceiptData(db, result.sale, result.items, result.payments, uiLanguage)
      }
    )
  )
}
