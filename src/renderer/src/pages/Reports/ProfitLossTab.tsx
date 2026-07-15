import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfitLossResult } from '@shared/reports'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import { DateRangePicker } from './DateRangePicker'
import { ReportTable } from './ReportTable'
import { defaultDateRange, toQueryDateRange } from './dateRangeDefaults'
import formStyles from '../../components/Form/formStyles.module.css'

export function ProfitLossTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [{ from, to }, setRange] = useState(defaultDateRange())
  const [result, setResult] = useState<ProfitLossResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.reports
      .profitLoss(toQueryDateRange(from, to))
      .then(setResult)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  const columns = [
    { key: 'label', label: '' },
    { key: 'amount', label: '', align: 'right' as const }
  ]

  const rows = result
    ? [
        { label: t('reports.profitLoss.revenue'), amount: formatCurrency(result.revenue, lang) },
        { label: t('reports.profitLoss.cogs'), amount: formatCurrency(result.cogs, lang) }
      ]
    : []

  const totals = result
    ? { label: t('reports.profitLoss.grossProfit'), amount: formatCurrency(result.grossProfit, lang) }
    : undefined

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      <DateRangePicker from={from} to={to} onChange={(f, tt) => setRange({ from: f, to: tt })} />

      <ReportTable
        title={t('reports.tabs.profitLoss')}
        columns={columns}
        rows={rows}
        totals={totals}
        loading={loading}
        note={t('reports.profitLoss.note')}
      />
    </div>
  )
}
