import { useTranslation } from 'react-i18next'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './DateRangePicker.module.css'

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className={styles.row}>
      <div className={formStyles.field}>
        <label className={formStyles.label}>{t('reports.dateRange.from')}</label>
        <input
          className={formStyles.input}
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label}>{t('reports.dateRange.to')}</label>
        <input
          className={formStyles.input}
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </div>
    </div>
  )
}
