import ExcelJS from 'exceljs'
import type { ReportTableSpec } from '../../shared/reports'

const MAX_SHEET_NAME_LENGTH = 31 // hard Excel limit

export async function renderReportExcel(spec: ReportTableSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(spec.title.slice(0, MAX_SHEET_NAME_LENGTH) || 'Report')

  sheet.columns = spec.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: 24,
    style: { alignment: { horizontal: c.align ?? 'left' } }
  }))
  sheet.getRow(1).font = { bold: true }

  sheet.addRows(spec.rows)

  if (spec.totals) {
    const totalsRow = sheet.addRow(spec.totals)
    totalsRow.font = { bold: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
