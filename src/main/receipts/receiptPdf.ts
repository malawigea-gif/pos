import { BrowserWindow } from 'electron'
import { buildReceiptHtml } from './receiptHtml'
import type { ReceiptData, ReceiptPaperSize } from '../../shared/sales'

const MICRONS_PER_MM = 1000

/** Renders the receipt to a PDF buffer using a hidden, throwaway window —
 *  the only reliable way to get Chromium's PDF engine to render arbitrary
 *  HTML that isn't the visible app window. Not exercised by unit tests
 *  (requires a real Electron runtime); verify manually via the app. */
export async function renderReceiptPdf(data: ReceiptData, paperSize: ReceiptPaperSize): Promise<Buffer> {
  const html = buildReceiptHtml(data, paperSize)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, offscreen: true }
  })

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF(
      paperSize === '80mm'
        ? {
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 80 * MICRONS_PER_MM, height: 297 * MICRONS_PER_MM }
          }
        : {
            printBackground: true,
            margins: { marginType: 'default' },
            pageSize: paperSize === 'a4' ? 'A4' : 'A5'
          }
    )
  } finally {
    win.destroy()
  }
}
