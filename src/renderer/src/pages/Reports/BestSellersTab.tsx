import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BookSalesRow } from '@shared/reports'
import type { SupportedLanguage } from '../../i18n'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import { DateRangePicker } from './DateRangePicker'
import { ReportTable } from './ReportTable'
import { defaultDateRange, toQueryDateRange } from './dateRangeDefaults'
import formStyles from '../../components/Form/formStyles.module.css'

type Mode = 'best' | 'slow'

export function BestSellersTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [{ from, to }, setRange] = useState(defaultDateRange())
  const [mode, setMode] = useState<Mode>('best')
  const [limit, setLimit] = useState('20')
  const [rows, setRows] = useState<BookSalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const range = toQueryDateRange(from, to)
    const limitNumber = Number(limit) || 20
    const fetcher = mode === 'best' ? window.api.reports.bestSellers : window.api.reports.slowMovers
    fetcher(range, limitNumber)
      .then(setRows)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, mode, limit])

  const columns = [
    { key: 'title', label: t('reports.bestSellers.table.title') },
    { key: 'isbn', label: t('reports.bestSellers.table.isbn') },
    { key: 'quantitySold', label: t('reports.bestSellers.table.quantitySold'), align: 'right' as const },
    { key: 'revenue', label: t('reports.bestSellers.table.revenue'), align: 'right' as const }
  ]

  const tableRows = rows.map((r) => ({
    title: r.title,
    isbn: r.isbn ?? '',
    quantitySold: formatNumber(r.quantitySold, lang),
    revenue: formatCurrency(r.revenue, lang)
  }))

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      <DateRangePicker from={from} to={to} onChange={(f, tt) => setRange({ from: f, to: tt })} />

      <div className={formStyles.row}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('reports.bestSellers.mode')}</label>
          <select className={formStyles.select} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="best">{t('reports.bestSellers.modeOptions.best')}</option>
            <option value="slow">{t('reports.bestSellers.modeOptions.slow')}</option>
          </select>
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('reports.bestSellers.limit')}</label>
          <input
            className={formStyles.input}
            type="number"
            min="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
      </div>

      <ReportTable
        title={t(`reports.bestSellers.modeOptions.${mode}`)}
        columns={columns}
        rows={tableRows}
        loading={loading}
      />
    </div>
  )
}
