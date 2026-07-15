import { BrowserWindow } from 'electron'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
import { buildReceiptTextBuffer } from './receiptBuffer'
import { buildReceiptHtml } from './receiptHtml'
import type { ReceiptData } from '../../shared/sales'

const PX_PER_MM_AT_203DPI = 8

async function captureReceiptImage(data: ReceiptData, widthMm: number): Promise<Buffer> {
  const width = Math.round(widthMm * PX_PER_MM_AT_203DPI)
  const win = new BrowserWindow({ show: false, width, height: 50, webPreferences: { sandbox: true } })
  try {
    const html = buildReceiptHtml(data, '80mm')
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const contentHeight = (await win.webContents.executeJavaScript(
      'document.body.scrollHeight'
    )) as number
    win.setContentSize(width, Math.max(50, Math.ceil(contentHeight)))
    const image = await win.webContents.capturePage()
    return image.toPNG()
  } finally {
    win.destroy()
  }
}

export interface PrintReceiptOptions {
  interfaceName: string
  paperWidthMm?: 58 | 80
  openDrawer?: boolean
}

/** Sends a receipt to a physical ESC/POS thermal printer over the
 *  configured interface (e.g. `printer:AUTO` for a Windows print-queue
 *  printer, or `tcp://<ip>:9100` for a network one).
 *
 *  Best-effort and NOT covered by unit tests — there is no physical
 *  thermal printer in this environment to verify against. Expect real
 *  failures here (no printer configured, device offline, driver missing)
 *  and make sure they surface as a catchable error rather than crash the
 *  app; verify manually against real hardware before relying on this. */
export async function printReceiptThermal(data: ReceiptData, options: PrintReceiptOptions): Promise<void> {
  const paperWidthChars = options.paperWidthMm === 58 ? 32 : 48
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: options.interfaceName,
    width: paperWidthChars,
    removeSpecialCharacters: false
  })

  if (data.language === 'si') {
    // Sinhala glyphs don't exist in any ESC/POS built-in code page, so the
    // receipt is rendered to a bitmap and printed as an image instead of text.
    const png = await captureReceiptImage(data, options.paperWidthMm ?? 80)
    await printer.printImageBuffer(png)
  } else {
    const textBuffer = buildReceiptTextBuffer(data, { interfaceName: options.interfaceName, paperWidthChars })
    printer.setBuffer(textBuffer)
  }

  if (options.openDrawer) {
    printer.openCashDrawer()
  }
  printer.cut()

  await printer.execute()
}
