import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GroupedSalesRow, SalesGroupBy } from '@shared/reports'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import { DateRangePicker } from './DateRangePicker'
import { ReportTable } from './ReportTable'
import { defaultDateRange, toQueryDateRange } from './dateRangeDefaults'
import formStyles from '../../components/Form/formStyles.module.css'

const GROUP_BYS: SalesGroupBy[] = ['category', 'author', 'supplier', 'cashier']

const FETCHERS: Record<SalesGroupBy, (range: { from: string; to: string }) => Promise<GroupedSalesRow[]>> = {
  category: (range) => window.api.reports.byCategory(range),
  author: (range) => window.api.reports.byAuthor(range),
  supplier: (range) => window.api.reports.bySupplier(range),
  cashier: (range) => window.api.reports.byCashier(range)
}

export function SalesByTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [{ from, to }, setRange] = useState(defaultDateRange())
  const [groupBy, setGroupBy] = useState<SalesGroupBy>('category')
  const [rows, setRows] = useState<GroupedSalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    FETCHERS[groupBy](toQueryDateRange(from, to))
      .then(setRows)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, groupBy])

  function fallbackLabel(row: GroupedSalesRow): string {
    if (row.label) return row.label
    if (groupBy === 'category') return t('reports.salesBy.uncategorized')
    if (groupBy === 'author') return t('reports.salesBy.unknownAuthor')
    if (groupBy === 'supplier') return t('reports.salesBy.unknownSupplier')
    return row.key
  }

  const columns = [
    { key: 'label', label: t('reports.salesBy.table.label') },
    { key: 'quantitySold', label: t('reports.salesBy.table.quantitySold'), align: 'right' as const },
    { key: 'revenue', label: t('reports.salesBy.table.revenue'), align: 'right' as const }
  ]

  const tableRows = rows.map((r) => ({
    label: fallbackLabel(r),
    quantitySold: formatNumber(r.quantitySold, lang),
    revenue: formatCurrency(r.revenue, lang)
  }))

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      <DateRangePicker from={from} to={to} onChange={(f, tt) => setRange({ from: f, to: tt })} />

      <div className={formStyles.field}>
        <label className={formStyles.label}>{t('reports.salesBy.groupBy')}</label>
        <select
          className={formStyles.select}
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as SalesGroupBy)}
        >
          {GROUP_BYS.map((g) => (
            <option key={g} value={g}>
              {t(`reports.salesBy.groupByOptions.${g}`)}
            </option>
          ))}
        </select>
      </div>

      <ReportTable
        title={`${t('reports.tabs.salesBy')} — ${t(`reports.salesBy.groupByOptions.${groupBy}`)}`}
        columns={columns}
        rows={tableRows}
        loading={loading}
        note={groupBy === 'supplier' ? t('reports.salesBy.supplierNote') : undefined}
      />
    </div>
  )
}
