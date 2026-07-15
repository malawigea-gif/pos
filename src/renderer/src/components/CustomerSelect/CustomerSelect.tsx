import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import formStyles from '../Form/formStyles.module.css'
import styles from './CustomerSelect.module.css'

interface CustomerSelectProps {
  customer: Customer | null
  onChange: (customer: Customer | null) => void
}

export function CustomerSelect({ customer, onChange }: CustomerSelectProps): JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Customer[]>([])

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setResults(await window.api.customers.list({ search: search.trim() }))
    }, 150)
    return () => clearTimeout(timeout)
  }, [search])

  if (customer) {
    return (
      <div className={styles.customerBadge}>
        <span>{customer.name}</span>
        <button type="button" onClick={() => onChange(null)}>
          {t('sales.payment.walkIn')}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.searchBox}>
      <input
        className={formStyles.input}
        placeholder={t('sales.payment.customerSearchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.length > 0 && (
        <ul className={styles.resultsList}>
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c)
                  setSearch('')
                  setResults([])
                }}
              >
                <span>{c.name}</span>
                <span className={styles.resultMeta}>{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
