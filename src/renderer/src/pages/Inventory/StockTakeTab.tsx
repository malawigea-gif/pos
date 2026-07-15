import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StockTake, StockTakeItemView } from '@shared/inventory'
import { useDescribeError } from '../../lib/ipcError'
import { formatDateTime } from '../../lib/format'
import type { SupportedLanguage } from '../../i18n'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './StockTakeTab.module.css'

export function StockTakeTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const describeError = useDescribeError()

  const [stockTake, setStockTake] = useState<StockTake | null | undefined>(undefined)
  const [items, setItems] = useState<StockTakeItemView[]>([])
  const [countedInputs, setCountedInputs] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadCurrent(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const current = await window.api.inventory.getCurrentStockTake()
      setStockTake(current ?? null)
      if (current) {
        const currentItems = await window.api.inventory.listStockTakeItems(current.id)
        setItems(currentItems)
        setCountedInputs(
          Object.fromEntries(currentItems.map((i) => [i.id, i.counted_qty === null ? '' : String(i.counted_qty)]))
        )
      } else {
        setItems([])
        setCountedInputs({})
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStart(): Promise<void> {
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      await window.api.inventory.startStockTake()
      await loadCurrent()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleBlur(itemId: number): Promise<void> {
    const raw = countedInputs[itemId]
    if (raw === undefined || raw === '') return
    try {
      await window.api.inventory.recordStockTakeCount(itemId, Number(raw))
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, counted_qty: Number(raw) } : i)))
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleComplete(): Promise<void> {
    if (!stockTake) return
    const confirmed = window.confirm(t('inventory.stockTake.confirmComplete'))
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      const varianceCount = items.filter((i) => i.counted_qty !== null && i.counted_qty !== i.expected_qty)
        .length
      await window.api.inventory.completeStockTake(stockTake.id)
      setSummary(t('inventory.stockTake.completedSummary', { count: varianceCount }))
      await loadCurrent()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const allCounted = items.length > 0 && items.every((i) => countedInputs[i.id] !== '' && countedInputs[i.id] !== undefined)

  if (loading) return <p>{t('common.loading')}</p>

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}
      {summary && <div className={styles.summary}>{summary}</div>}

      {!stockTake ? (
        <div>
          <p>{t('inventory.stockTake.noActive')}</p>
          <button
            type="button"
            className={formStyles.buttonPrimary}
            onClick={handleStart}
            disabled={busy}
          >
            {t('inventory.stockTake.start')}
          </button>
        </div>
      ) : (
        <div>
          <div className={styles.header}>
            <p>
              {t('inventory.stockTake.inProgress', {
                date: formatDateTime(new Date(stockTake.started_at), i18n.language as SupportedLanguage)
              })}
            </p>
            <button
              type="button"
              className={formStyles.buttonPrimary}
              onClick={handleComplete}
              disabled={busy || !allCounted}
            >
              {t('inventory.stockTake.complete')}
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('inventory.stockTake.table.book')}</th>
                <th>{t('inventory.stockTake.table.expected')}</th>
                <th>{t('inventory.stockTake.table.counted')}</th>
                <th>{t('inventory.stockTake.table.variance')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const countedRaw = countedInputs[item.id] ?? ''
                const counted = countedRaw === '' ? null : Number(countedRaw)
                const variance = counted === null ? null : counted - item.expected_qty
                return (
                  <tr key={item.id}>
                    <td>
                      {item.book_title}
                      {item.book_isbn && <span className={styles.isbn}> ({item.book_isbn})</span>}
                    </td>
                    <td>{item.expected_qty}</td>
                    <td>
                      <input
                        className={formStyles.input}
                        type="number"
                        value={countedRaw}
                        onChange={(e) =>
                          setCountedInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onBlur={() => handleBlur(item.id)}
                      />
                    </td>
                    <td className={variance ? styles.varianceNonZero : undefined}>
                      {variance !== null ? variance : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
