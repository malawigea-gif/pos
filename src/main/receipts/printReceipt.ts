import { BrowserWindow, screen } from 'electron'
import type { NativeImage } from 'electron'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
import { buildReceiptTextBuffer } from './receiptBuffer'
import { buildReceiptHtml } from './receiptHtml'
import { printRawBufferOnWindows, resolveWindowsPrinterName } from './windowsRawPrinter'
import type { ReceiptData } from '../../shared/sales'

const PX_PER_MM_AT_203DPI = 8
const CSS_DPI = 96

/** node-thermal-printer's printImageBuffer() sends the entire image as one
 *  `GS v 0` raster command with no chunking of its own — fine for short
 *  logos, but a full Sinhala receipt (rasterized because Sinhala has no
 *  ESC/POS code page, see printReceiptThermal below) is easily 1000+ dots
 *  tall. On this project's real till printer, that one giant command was
 *  cutting the print off partway through — the paper physically got cut
 *  right where the data stopped — with no error surfaced anywhere in the
 *  app, while the on-screen preview (which never touches the printer)
 *  showed the full receipt correctly. Ruled out first: the resize/paint
 *  timing in captureReceiptImage below (already hardened with the
 *  double-rAF wait) — the truncation persisted identically after that fix,
 *  which is what points at the printer's own receive buffer rejecting or
 *  dropping the tail of one oversized raster command, not a rendering
 *  race. Fix: send the image as multiple shorter bands instead of one tall
 *  one. 256 dots/band is a conservative, widely-used figure for ESC/POS
 *  raster images (matches what other POS raster-printing libraries default
 *  to) and comfortably fits typical printer buffers. */
const RASTER_BAND_HEIGHT_DOTS = 256

/** buildReceiptHtml's '80mm' stylesheet sizes everything in `mm`/`px`,
 *  which Chromium resolves at the standard 96dpi. The hidden capture
 *  window below is sized in pixels at thermal-printer density (203dpi)
 *  so the raster maps 1 pixel to 1 print dot — without this zoom, the
 *  96dpi-authored content only fills a fraction of that wider/denser
 *  window (blank margins) and prints at roughly half its intended
 *  physical size. `zoom` (unlike page/browser zoom) reflows layout, so
 *  it scales the mm-based content up to fill the 203dpi-sized window
 *  while preserving each element's intended physical dimensions. */
const RASTER_ZOOM = (PX_PER_MM_AT_203DPI * 25.4) / CSS_DPI

/** Spinning up a fresh hidden BrowserWindow (a whole new renderer process)
 *  for every single receipt was measured at ~1.7-2s just for loadURL() to
 *  resolve — the dominant cause of the "print feels late" delay reported
 *  for Sinhala receipts. Reusing one hidden window across prints (just
 *  re-navigating it via loadURL each time) cuts that to ~300-450ms after
 *  the first print, since the renderer process already exists. */
let captureWindow: BrowserWindow | null = null

/** Fixed DIP height the capture window is created at and left at
 *  permanently — see the comment on captureReceiptImage below for why this
 *  window is never resized after creation. 4000px at 203dpi is ~500mm of
 *  paper, far beyond any realistic single receipt. */
const CAPTURE_WINDOW_HEIGHT_PX = 4000

function getCaptureWindow(width: number): BrowserWindow {
  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = new BrowserWindow({
      show: false,
      width,
      height: CAPTURE_WINDOW_HEIGHT_PX,
      webPreferences: { sandbox: true }
    })
  } else if (captureWindow.getContentSize()[0] !== width) {
    captureWindow.setContentSize(width, CAPTURE_WINDOW_HEIGHT_PX)
  }
  return captureWindow
}

async function captureReceiptImage(data: ReceiptData, widthMm: number): Promise<NativeImage> {
  const targetPxWidth = Math.round(widthMm * PX_PER_MM_AT_203DPI)
  // capturePage() rasterizes at (DIP size × display scale factor), not the
  // DIP size alone — on a scaled display (125%/150%/etc., common on laptops)
  // an un-corrected window would capture wider/taller than targetPxWidth.
  // Shrinking the DIP size by scaleFactor, and the zoom by the same factor,
  // keeps the final raster at exactly targetPxWidth regardless of host
  // display scaling.
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
  const width = Math.round(targetPxWidth / scaleFactor)
  const win = getCaptureWindow(width)
  const html = buildReceiptHtml(data, '80mm', RASTER_ZOOM / scaleFactor)
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  // The embedded Sinhala webfont (@font-face, base64) hasn't necessarily
  // finished loading/shaping by the time loadURL's promise resolves —
  // scrollHeight read before document.fonts.ready reflects the fallback
  // font's (shorter) layout.
  await win.webContents.executeJavaScript('document.fonts.ready')
  const contentHeight = (await win.webContents.executeJavaScript(
    'document.body.scrollHeight'
  )) as number
  // Deliberately NOT calling win.setContentSize() here. An earlier version
  // resized the window to the measured content height right before
  // capturePage() — on paper that sounds fine, and even survived a
  // double-requestAnimationFrame wait added to rule out a paint race, but
  // real hardware kept printing a receipt truncated at the same point
  // every time regardless. The one thing common to every failed attempt
  // was resizing a *hidden* (`show: false`) window between load and
  // capture — hidden windows aren't guaranteed to recomposite promptly (or
  // at all, on some GPU/driver combinations) when their bounds change,
  // no matter how many frames you wait. The window is instead created
  // once at a fixed, generous height (CAPTURE_WINDOW_HEIGHT_PX) and never
  // resized again; capturePage()'s own `rect` argument crops down to the
  // real content height directly, so there is nothing left to race against.
  const cropHeight = Math.min(Math.max(50, Math.ceil(contentHeight)), CAPTURE_WINDOW_HEIGHT_PX)
  return win.webContents.capturePage({ x: 0, y: 0, width, height: cropHeight })
}

/** Splits a captured receipt image into horizontal bands and sends each as
 *  its own `GS v 0` raster command — see RASTER_BAND_HEIGHT_DOTS above for
 *  why a single command isn't safe for a full receipt's height. Bands are
 *  printed strictly in order on the same printer buffer, so they lay back
 *  out as one continuous receipt with no visible seam. */
async function printBandedImage(printer: ThermalPrinter, image: NativeImage): Promise<void> {
  const { width, height } = image.getSize()
  for (let y = 0; y < height; y += RASTER_BAND_HEIGHT_DOTS) {
    const bandHeight = Math.min(RASTER_BAND_HEIGHT_DOTS, height - y)
    const band = image.crop({ x: 0, y, width, height: bandHeight })
    await printer.printImageBuffer(band.toPNG())
  }
}

/** Pre-creates the hidden capture window used to rasterize Sinhala receipts
 *  (see getCaptureWindow above) during app startup instead of lazily on the
 *  first print. Spinning up a fresh BrowserWindow/renderer process was
 *  measured at ~1.7-2s — paying that cost once at launch, while the cashier
 *  is still logging in / opening the till, keeps it off the critical path
 *  of the first real print of the day, which is where it was most
 *  noticeable as a "why is printing so slow" complaint. */
export function warmUpReceiptCaptureWindow(): void {
  getCaptureWindow(1)
}

export interface PrintReceiptOptions {
  interfaceName: string
  paperWidthMm?: 58 | 80
  openDrawer?: boolean
}

/** Sends a receipt to a physical ESC/POS thermal printer over the
 *  configured interface (e.g. `printer:AUTO` for the Windows default
 *  printer, or `printer:<name>` for a specific one — `tcp://<ip>:9100`
 *  for a network printer still goes through node-thermal-printer's own
 *  network interface).
 *
 *  `printer:*` interfaces are built here rather than handed to
 *  node-thermal-printer's built-in `printer:` interface, which requires
 *  the `printer` npm package as a `driver` — that package is unmaintained,
 *  has no prebuilt binaries for modern Electron, and fails to install in
 *  this environment. Bytes go to Windows via a small PowerShell/Win32
 *  helper instead — see windowsRawPrinter.ts.
 *
 *  Best-effort and NOT covered by unit tests. Expect real failures here
 *  (no printer configured, device offline) and make sure they surface as
 *  a catchable error rather than crash the app.
 *
 *  paperWidthChars for 80mm is 42, not the commonly-cited 48 — confirmed
 *  by printing an unbroken ruler line to a real BIXOLON SRP-350plusIII
 *  and counting where the printer's own hardware wrapped it (42 chars).
 *  node-thermal-printer's tableCustom() pads a row out to exactly
 *  `width` characters as one continuous ESC/POS text run with a single
 *  trailing newline; if `width` overstates the printer's real column
 *  count, the printer auto-wraps mid-row before that newline arrives —
 *  which is what was splitting qty/total onto their own line. The 58mm
 *  value (32) is the generic spec figure and hasn't been verified against
 *  real 58mm hardware the way 80mm now has. */
export async function printReceiptThermal(data: ReceiptData, options: PrintReceiptOptions): Promise<void> {
  const paperWidthChars = options.paperWidthMm === 58 ? 32 : 42
  const isWindowsPrinterInterface = /^printer:/i.test(options.interfaceName.trim())
  // node-thermal-printer's own JS accepts an object here (getInterface()
  // returns it as-is and uses it as the Interface implementation) — only
  // its .d.ts narrows this to `string`, so the cast below just corrects
  // the type to match the library's actual documented runtime behavior.
  const rawInterface = isWindowsPrinterInterface
    ? { execute: (buffer: Buffer) => printRawBufferOnWindows(buffer, resolveWindowsPrinterName(options.interfaceName)) }
    : options.interfaceName
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: rawInterface as unknown as string,
    width: paperWidthChars,
    removeSpecialCharacters: false
  })

  if (data.language === 'si') {
    // Sinhala glyphs don't exist in any ESC/POS built-in code page, so the
    // receipt is rendered to a bitmap and printed as an image instead of
    // text — banded into multiple raster commands, see printBandedImage.
    const image = await captureReceiptImage(data, options.paperWidthMm ?? 80)
    await printBandedImage(printer, image)
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
