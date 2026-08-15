import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** Sends raw bytes to a Windows printer via the Win32 spooler
 *  (winspool.drv OpenPrinter/StartDocPrinter/WritePrinter — the standard
 *  "RawPrinterHelper" pattern from Microsoft KB322091), compiled on the fly
 *  by PowerShell's `Add-Type`.
 *
 *  This deliberately avoids the `printer` npm package that
 *  node-thermal-printer's built-in `printer:` interface expects: that
 *  package is unmaintained (last published ~2015), ships no prebuilt
 *  binaries for modern Electron, and its own install script fails as a
 *  nested npm lifecycle call in this environment. PowerShell + .NET is
 *  already present on every Windows install this app targets, so there's
 *  nothing extra to build or rebuild per Electron version.
 *
 *  Performance note: `Add-Type -TypeDefinition` invokes the C# compiler
 *  (csc.exe) fresh every time it runs — that's the actual source of the
 *  multi-second "print feels late" delay users see, not the printer or the
 *  spooler. The script below compiles the helper class to a cached .dll
 *  under `%LOCALAPPDATA%` on first use only, and every call after that
 *  loads the already-compiled assembly via `Add-Type -Path` (no compiler
 *  invocation, just a fast in-process assembly load) — first print after
 *  install/update is slow, every one after that is fast. */

const RAW_PRINT_SCRIPT = String.raw`
param(
  [Parameter(Mandatory=$true)][AllowEmptyString()][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$DataFile
)
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($PrinterName) -or $PrinterName -ieq 'auto' -or $PrinterName -ieq 'default') {
  # System.Drawing.Printing.PrinterSettings.DefaultPrinterName is unreliable
  # here — it came back empty in testing even with a default printer set in
  # Windows (likely a per-process/session registry quirk). Win32_Printer's
  # Default property is what Windows itself reports and matches Devices &
  # Printers, so it's used instead.
  $PrinterName = (Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1 -ExpandProperty Name)
}
if ([string]::IsNullOrWhiteSpace($PrinterName)) {
  Write-Error 'No default Windows printer is configured.'
  exit 1
}

# Compile the helper once and cache it — see the perf note in
# windowsRawPrinter.ts for why this matters (Add-Type -TypeDefinition
# re-invokes csc.exe on every call otherwise, which is the real cause of
# the print delay, not the printer/spooler itself).
$CacheDir = Join-Path $env:LOCALAPPDATA 'LankaPOS-PrintHelper'
# The 'v1' suffix is a manual cache-buster: bump it (v2, v3, ...) if the C#
# source below ever changes, otherwise installs that already compiled v1
# would keep loading the stale cached .dll forever and silently miss the
# update.
$AssemblyPath = Join-Path $CacheDir 'LankaPosRawPrinter.v1.dll'

if (Test-Path $AssemblyPath) {
  Add-Type -Path $AssemblyPath
} else {
  if (-not (Test-Path $CacheDir)) {
    New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
  }
  Add-Type -OutputAssembly $AssemblyPath -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class LankaPosRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static void SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed for '" + printerName + "', error " + Marshal.GetLastWin32Error());
    }
    try {
      DOCINFOA di = new DOCINFOA();
      di.pDocName = "LankaPOS Receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new Exception("StartDocPrinter failed, error " + Marshal.GetLastWin32Error());
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new Exception("StartPagePrinter failed, error " + Marshal.GetLastWin32Error());
        }
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
          int written;
          if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written)) {
            throw new Exception("WritePrinter failed, error " + Marshal.GetLastWin32Error());
          }
          if (written != bytes.Length) {
            throw new Exception("WritePrinter only wrote " + written + " of " + bytes.Length + " bytes");
          }
        } finally {
          Marshal.FreeCoTaskMem(pUnmanagedBytes);
        }
        EndPagePrinter(hPrinter);
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@
}

try {
  $bytes = [System.IO.File]::ReadAllBytes($DataFile)
  [LankaPosRawPrinter]::SendBytesToPrinter($PrinterName, $bytes)
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`

export class WindowsPrinterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WindowsPrinterError'
  }
}

/** Resolves a `receipt.printerInterface` setting value — historically an
 *  ESC/POS-library URI such as `printer:AUTO` or `printer:EPSON-TM-T88` —
 *  down to a bare Windows printer name. Empty/'auto'/'default' means "use
 *  whatever Windows has set as the default printer", which is resolved
 *  inside the PowerShell helper via Win32_Printer's Default property. */
export function resolveWindowsPrinterName(interfaceName: string | undefined): string {
  if (!interfaceName) return ''
  const match = /^printer:(.*)$/i.exec(interfaceName.trim())
  const name = (match ? match[1] : interfaceName).trim()
  return name.toLowerCase() === 'auto' || name.toLowerCase() === 'default' ? '' : name
}

function runPowerShellScript(scriptFile: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile, ...args],
      { windowsHide: true }
    )
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => {
      reject(new WindowsPrinterError(`Failed to launch PowerShell: ${err.message}`))
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new WindowsPrinterError(`Printing failed (exit ${code}): ${stderr.trim() || 'no output from PowerShell'}`))
    })
  })
}

/** Sends a raw ESC/POS byte buffer to a Windows printer. `printerName` of
 *  `''` means "use the Windows default printer". */
export async function printRawBufferOnWindows(buffer: Buffer, printerName: string): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lankapos-print-'))
  const dataFile = path.join(dir, 'receipt.bin')
  const scriptFile = path.join(dir, 'print.ps1')
  try {
    await writeFile(dataFile, buffer)
    await writeFile(scriptFile, RAW_PRINT_SCRIPT, 'utf8')
    await runPowerShellScript(scriptFile, ['-PrinterName', printerName, '-DataFile', dataFile])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
