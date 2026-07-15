import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SalesSummaryRow, SummaryGranularity } from '@shared/reports'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import { DateRangePicker } from './DateRangePicker'
import { ReportTable } from './ReportTable'
import { defaultDateRange, toQueryDateRange } from './dateRangeDefaults'
import formStyles from '../../components/Form/formStyles.module.css'

const GRANULARITIES: SummaryGranularity[] = ['day', 'week', 'month']

export function SummaryTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [{ from, to }, setRange] = useState(defaultDateRange())
  const [granularity, setGranularity] = useState<SummaryGranularity>('day')
  const [rows, setRows] = useState<SalesSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.reports
      .salesSummary(toQueryDateRange(from, to), granularity)
      .then(setRows)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, granularity])

  const columns = [
    { key: 'period', label: t('reports.summary.table.period') },
    { key: 'salesCount', label: t('reports.summary.table.salesCount'), align: 'right' as const },
    { key: 'itemsSold', label: t('reports.summary.table.itemsSold'), align: 'right' as const },
    { key: 'revenue', label: t('reports.summary.table.revenue'), align: 'right' as const }
  ]

  const tableRows = rows.map((r) => ({
    period: r.period,
    salesCount: formatNumber(r.salesCount, lang),
    itemsSold: formatNumber(r.itemsSold, lang),
    revenue: formatCurrency(r.revenue, lang)
  }))

  const totals =
    rows.length > 0
      ? {
          period: t('reports.totalLabel'),
          salesCount: formatNumber(
            rows.reduce((sum, r) => sum + r.salesCount, 0),
            lang
          ),
          itemsSold: formatNumber(
            rows.reduce((sum, r) => sum + r.itemsSold, 0),
            lang
          ),
          revenue: formatCurrency(
            rows.reduce((sum, r) => sum + r.revenue, 0),
            lang
          )
        }
      : undefined

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      <DateRangePicker from={from} to={to} onChange={(f, tt) => setRange({ from: f, to: tt })} />

      <div className={formStyles.field}>
        <label className={formStyles.label}>{t('reports.summary.granularity')}</label>
        <select
          className={formStyles.select}
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as SummaryGranularity)}
        >
          {GRANULARITIES.map((g) => (
            <option key={g} value={g}>
              {t(`reports.summary.granularityOptions.${g}`)}
            </option>
          ))}
        </select>
      </div>

      <ReportTable
        title={t('reports.tabs.summary')}
        columns={columns}
        rows={tableRows}
        totals={totals}
        loading={loading}
      />
    </div>
  )
}
