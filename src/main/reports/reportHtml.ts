import { SINHALA_FONT_BASE64 } from '../receipts/sinhalaFontBase64'
import type { ReportTableSpec } from '../../shared/reports'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cell(value: string | number | undefined, align: 'left' | 'right'): string {
  const text = value === undefined ? '' : escapeHtml(String(value))
  return `<td style="text-align:${align}">${text}</td>`
}

/** Builds a self-contained report HTML document (Sinhala font embedded as
 *  base64, same as receipts) — used as the source for the PDF export. */
export function buildReportHtml(spec: ReportTableSpec): string {
  const headerCells = spec.columns
    .map((c) => `<th style="text-align:${c.align ?? 'left'}">${escapeHtml(c.label)}</th>`)
    .join('')

  const bodyRows = spec.rows
    .map((row) => `<tr>${spec.columns.map((c) => cell(row[c.key], c.align ?? 'left')).join('')}</tr>`)
    .join('')

  const totalsRow = spec.totals
    ? `<tr class="totals">${spec.columns
        .map((c) => cell(spec.totals?.[c.key], c.align ?? 'left'))
        .join('')}</tr>`
    : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Noto Sans Sinhala';
    src: url(data:font/woff2;base64,${SINHALA_FONT_BASE64}) format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Sinhala', 'Segoe UI', sans-serif;
    margin: 16mm;
    font-size: 11px;
    color: #000;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 11px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #ccc; }
  th { background: #f2f2f2; font-size: 10px; text-transform: uppercase; }
  tr.totals td { font-weight: 700; border-top: 2px solid #000; border-bottom: none; }
</style>
</head>
<body>
  <h1>${escapeHtml(spec.title)}</h1>
  <p class="muted">${escapeHtml(spec.generatedAt)}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}${totalsRow}</tbody>
  </table>
</body>
</html>`
}
