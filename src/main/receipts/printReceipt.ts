import { BrowserWindow, screen } from 'electron'
import type { NativeImage } from 'electron'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
import { PNG } from 'pngjs'
import { buildReceiptTextBuffer } from './receiptBuffer'
import { buildReceiptHtml, RASTER_CONTENT_WIDTH_MM } from './receiptHtml'
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

/** Real-hardware retest (2026-09-23): after fixing the width-clipping bug
 *  above, a receipt long enough to include the Payment/Paid/Change/Profit
 *  block (i.e. more than ~2-3 bands' worth of content) still cut off
 *  partway through — always right around the same point, a couple of
 *  bands in, never earlier and never later. Splitting into RASTER_BAND_
 *  HEIGHT_DOTS-sized commands (above) fixed the *single oversized command*
 *  case, but all those small commands were still being queued into ONE
 *  ThermalPrinter buffer and written to the printer in a SINGLE WritePrinter
 *  call (see printBandedImage below, and windowsRawPrinter.ts) — so the
 *  printer's own small onboard receive buffer can still be overrun by the
 *  cumulative byte stream for a long receipt, even though no single command
 *  in it is oversized. The command boundaries help the printer's firmware
 *  parse/print incrementally, but do nothing to pace *how fast* the bytes
 *  arrive — that requires actually splitting the transmission itself, not
 *  just the command structure inside one transmission.
 *
 *  Fix: printBandedImage now calls printer.execute() (a real WritePrinter
 *  call) after each individual band and printer.clear()s the buffer before
 *  building the next one, with a short pause in between — giving the
 *  printer's print head time to actually consume/print each band before
 *  the next one's bytes arrive, instead of handing it the whole receipt's
 *  raster data in one uninterrupted burst. This is the standard mitigation
 *  for exactly this symptom on small-buffer ESC/POS thermal printers.
 *  RASTER_BAND_DELAY_MS below is a conservative first guess, not measured
 *  against this specific BIXOLON's real drain rate — if a long receipt
 *  still clips (further down than before, but still short), try raising
 *  it before doing anything more invasive. */
const RASTER_BAND_DELAY_MS = 80

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

/** node-thermal-printer's own printer.printImageBuffer() (lib/types/epson.js)
 *  builds the `GS v 0` raster command as `1D 76 30 m ...` but hardcodes `m`
 *  (the print-mode byte) to decimal 48 — the ASCII digit '0' — instead of
 *  the raw byte 0x00 the ESC/POS spec requires (valid range is 0-3: normal/
 *  double-width/double-height/quadruple). Confirmed present in the
 *  installed 4.6.0 via a byte-level repro (no printer needed — the
 *  constructed command's 4th byte reads 0x30, not 0x00) — this is the root
 *  cause of Sinhala receipts printing as garbled bytes instead of the
 *  rendered image: printers that validate `m` against its documented range
 *  reject the whole command and print the following image bytes as loose
 *  data instead of raster payload. This rebuilds the exact same command —
 *  identical pixel-packing to the library's, which is otherwise unchanged
 *  and already validated against real hardware (see RASTER_BAND_HEIGHT_DOTS
 *  above) — with the corrected mode byte, and appends it via printer.add()
 *  (the library's own public append API) instead of the buggy method. */
export function buildRasterImageCommand(png: PNG): Buffer {
  const { width, height, data } = png
  const bytesPerRow = Math.ceil(width / 8)
  const imageBuffer = Buffer.alloc(bytesPerRow * height)

  let offset = 0
  for (let y = 0; y < height; y++) {
    for (let byteX = 0; byteX < bytesPerRow; byteX++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = byteX * 8 + bit
        if (x >= width) continue
        const idx = (width * y + x) << 2
        const alpha = data[idx + 3]
        if (alpha > 126) {
          const grayscale = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]
          if (grayscale < 128) byte |= 1 << (7 - bit)
        }
      }
      imageBuffer[offset++] = byte
    }
  }

  const header = Buffer.from([
    0x1d,
    0x76,
    0x30,
    0x00, // GS v 0, m = 0 (normal mode) — the byte the library gets wrong
    bytesPerRow & 0xff,
    0x00,
    height & 0xff,
    (height >> 8) & 0xff
  ])
  return Buffer.concat([header, imageBuffer])
}

/** Splits a captured receipt image into horizontal bands and sends each as
 *  its own `GS v 0` raster command, each flushed to the printer with its
 *  own execute() call and a short pause — see RASTER_BAND_HEIGHT_DOTS and
 *  RASTER_BAND_DELAY_MS above for why a single command, and a single
 *  unpaced write of all of them together, both aren't safe for a full
 *  receipt's height. Bands are still sent strictly in order, one after
 *  another, so they lay back out as one continuous receipt with no
 *  visible seam. */
async function printBandedImage(printer: ThermalPrinter, image: NativeImage): Promise<void> {
  const { width, height } = image.getSize()
  for (let y = 0; y < height; y += RASTER_BAND_HEIGHT_DOTS) {
    const bandHeight = Math.min(RASTER_BAND_HEIGHT_DOTS, height - y)
    const band = image.crop({ x: 0, y, width, height: bandHeight })
    const png = PNG.sync.read(band.toPNG())
    printer.add(buildRasterImageCommand(png))
    // Flush THIS band to the printer now (a real WritePrinter call via
    // execute()) and clear the buffer before the next one, instead of
    // accumulating every band into one giant end-of-receipt write — see
    // RASTER_BAND_DELAY_MS's comment above for why. printer.clear() is
    // safe to call mid-receipt here: it only resets the byte buffer (and
    // re-applies the configured code page, irrelevant for an image-only
    // buffer) — it doesn't touch the printer hardware itself.
    await printer.execute()
    printer.clear()
    await sleep(RASTER_BAND_DELAY_MS)
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
    // Capture at RASTER_CONTENT_WIDTH_MM (the exact width buildReceiptHtml's
    // '80mm' template renders at), NOT options.paperWidthMm (the nominal
    // paper size). An earlier fix narrowed only the CSS body width and left
    // this at the nominal 80mm, so the captured raster image stayed exactly
    // as wide as before with the content merely re-centered inside it —
    // the printer, which clips by total image width regardless of where
    // the visible content sits, cut the same dots and the print looked
    // unchanged. See RASTER_CONTENT_WIDTH_MM's own comment in receiptHtml.ts
    // for the full story. (58mm paper still renders this same '80mm'-style
    // template — buildReceiptHtml has no narrower template for it yet — so
    // it also gets RASTER_CONTENT_WIDTH_MM here rather than a mismatched
    // window size; giving 58mm hardware its own correctly-sized raster
    // template is a separate follow-up, not yet done.)
    const image = await captureReceiptImage(data, RASTER_CONTENT_WIDTH_MM)
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
