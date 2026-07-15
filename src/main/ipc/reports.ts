import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as reports from '../db/repositories/reportsRepository'
import { renderReportPdf } from '../reports/reportPdf'
import { renderReportExcel } from '../reports/reportExcel'
import { ipcHandler, withRole } from './errors'
import type { DateRange, ReportTableSpec, SummaryGranularity } from '../../shared/reports'

const MANAGE_ROLES = ['admin', 'manager'] as const

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'report'
}

async function saveBufferWithDialog(
  buffer: Buffer,
  defaultName: string,
  extension: string,
  filterName: string
): Promise<string | null> {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  const saveDialogOptions = {
    defaultPath: `${sanitizeFilename(defaultName)}.${extension}`,
    filters: [{ name: filterName, extensions: [extension] }]
  }
  const result = focusedWindow
    ? await dialog.showSaveDialog(focusedWindow, saveDialogOptions)
    : await dialog.showSaveDialog(saveDialogOptions)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, buffer)
  return result.filePath
}

export function registerReportsIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'reports:salesSummary',
    ipcHandler(
      withRole([...MANAGE_ROLES], (range: DateRange, granularity: SummaryGranularity) =>
        reports.getSalesSummary(db, range, granularity)
      )
    )
  )

  ipcMain.handle(
    'reports:bestSellers',
    ipcHandler(
      withRole([...MANAGE_ROLES], (range: DateRange, limit?: number) => reports.getBestSellers(db, range, limit))
    )
  )

  ipcMain.handle(
    'reports:slowMovers',
    ipcHandler(
      withRole([...MANAGE_ROLES], (range: DateRange, limit?: number) => reports.getSlowMovers(db, range, limit))
    )
  )

  ipcMain.handle(
    'reports:profitLoss',
    ipcHandler(withRole([...MANAGE_ROLES], (range: DateRange) => reports.getProfitAndLoss(db, range)))
  )

  ipcMain.handle(
    'reports:byCategory',
    ipcHandler(withRole([...MANAGE_ROLES], (range: DateRange) => reports.getSalesByCategory(db, range)))
  )
  ipcMain.handle(
    'reports:byAuthor',
    ipcHandler(withRole([...MANAGE_ROLES], (range: DateRange) => reports.getSalesByAuthor(db, range)))
  )
  ipcMain.handle(
    'reports:bySupplier',
    ipcHandler(withRole([...MANAGE_ROLES], (range: DateRange) => reports.getSalesBySupplier(db, range)))
  )
  ipcMain.handle(
    'reports:byCashier',
    ipcHandler(withRole([...MANAGE_ROLES], (range: DateRange) => reports.getSalesByCashier(db, range)))
  )

  ipcMain.handle(
    'reports:exportPdf',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (spec: ReportTableSpec): Promise<string | null> => {
        const buffer = await renderReportPdf(spec)
        return saveBufferWithDialog(buffer, spec.title, 'pdf', 'PDF')
      })
    )
  )

  ipcMain.handle(
    'reports:exportExcel',
    ipcHandler(
      withRole([...MANAGE_ROLES], async (spec: ReportTableSpec): Promise<string | null> => {
        const buffer = await renderReportExcel(spec)
        return saveBufferWithDialog(buffer, spec.title, 'xlsx', 'Excel')
      })
    )
  )
}
