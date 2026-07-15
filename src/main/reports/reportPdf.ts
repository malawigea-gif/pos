import { BrowserWindow } from 'electron'
import { buildReportHtml } from './reportHtml'
import type { ReportTableSpec } from '../../shared/reports'

/** Renders a report table to a PDF buffer using a hidden, throwaway window
 *  — same technique as the receipt PDF export. Reports are tabular and
 *  potentially wide, so this uses A4 rather than the receipt's narrow
 *  80mm page. */
export async function renderReportPdf(spec: ReportTableSpec): Promise<Buffer> {
  const html = buildReportHtml(spec)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, offscreen: true }
  })

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
  } finally {
    win.destroy()
  }
}
