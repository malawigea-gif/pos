import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book } from '@shared/inventory'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../Sales/SaleTab.module.css'

export interface LineItem {
  bookId: number
  title: string
  quantity: number
  unitCost: number
}

interface LineItemsEditorProps {
  lines: LineItem[]
  onChange: (lines: LineItem[]) => void
}

export function LineItemsEditor({ lines, onChange }: LineItemsEditorProps): JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Book[]>([])

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setResults(await window.api.inventory.listBooks({ search: search.trim() }))
    }, 150)
    return () => clearTimeout(timeout)
  }, [search])

  function addLine(book: Book): void {
    if (lines.some((l) => l.bookId === book.id)) return
    onChange([...lines, { bookId: book.id, title: book.title, quantity: 1, unitCost: book.cost_price }])
    setSearch('')
    setResults([])
  }

  function updateLine(bookId: number, patch: Partial<LineItem>): void {
    onChange(lines.map((l) => (l.bookId === bookId ? { ...l, ...patch } : l)))
  }

  function removeLine(bookId: number): void {
    onChange(lines.filter((l) => l.bookId !== bookId))
  }

  return (
    <div>
      <div className={styles.searchBox}>
        <input
          className={formStyles.input}
          placeholder={t('inventory.books.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <ul className={styles.resultsList}>
            {results.map((book) => (
              <li key={book.id}>
                <button type="button" onClick={() => addLine(book)}>
                  <span>{book.title}</span>
                  <span className={styles.resultMeta}>{book.isbn}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('suppliers.lineItem.book')}</th>
              <th>{t('suppliers.lineItem.quantity')}</th>
              <th>{t('suppliers.lineItem.unitCost')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.bookId}>
                <td>{line.title}</td>
                <td>
                  <input
                    className={styles.qtyInput}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.bookId, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    className={styles.qtyInput}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.bookId, { unitCost: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeLine(line.bookId)}>
                    {t('suppliers.lineItem.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
