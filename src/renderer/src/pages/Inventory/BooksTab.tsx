import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import { useDescribeError } from '../../lib/ipcError'
import { BookFormModal } from './BookFormModal'
import { StockAdjustModal } from './StockAdjustModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function BooksTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [adjustingBook, setAdjustingBook] = useState<Book | null>(null)

  async function loadCategories(): Promise<void> {
    setCategories(await window.api.inventory.listCategories())
  }

  async function loadBooks(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.inventory.listBooks({
        search: search.trim() || undefined,
        categoryId: categoryFilter === 'all' ? undefined : Number(categoryFilter)
      })
      setBooks(result)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(loadBooks, 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter])

  async function handleToggleActive(book: Book): Promise<void> {
    if (book.is_active) {
      const confirmed = window.confirm(
        t('inventory.books.confirmDeactivate', { title: book.title })
      )
      if (!confirmed) return
    }
    try {
      await window.api.inventory.setBookActive(book.id, !book.is_active)
      loadBooks()
    } catch (err) {
      setError(describeError(err))
    }
  }

  function afterSave(): void {
    setCreating(false)
    setEditingBook(null)
    loadCategories()
    loadBooks()
  }

  function afterAdjust(): void {
    setAdjustingBook(null)
    loadBooks()
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={formStyles.input}
          placeholder={t('inventory.books.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={formStyles.select}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">{t('common.all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={formStyles.buttonPrimary}
          onClick={() => setCreating(true)}
        >
          {t('inventory.books.addBook')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : books.length === 0 ? (
        <p>{t('inventory.books.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('inventory.books.table.title')}</th>
              <th>{t('inventory.books.table.author')}</th>
              <th>{t('inventory.books.table.isbn')}</th>
              <th>{t('inventory.books.table.stock')}</th>
              <th>{t('inventory.books.table.sellingPrice')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => {
              const lowStock = book.stock_qty <= book.reorder_level
              return (
                <tr key={book.id} className={book.is_active ? undefined : styles.inactiveRow}>
                  <td>
                    {book.title}
                    {lowStock && <span className={styles.badgeWarn}>{t('inventory.books.lowStock')}</span>}
                    {!book.is_active && (
                      <span className={styles.badgeMuted}>{t('inventory.books.inactive')}</span>
                    )}
                  </td>
                  <td>{book.author}</td>
                  <td>{book.isbn}</td>
                  <td>{book.stock_qty}</td>
                  <td>{book.selling_price.toFixed(2)}</td>
                  <td className={styles.actionsCell}>
                    <button type="button" onClick={() => setEditingBook(book)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" onClick={() => setAdjustingBook(book)}>
                      {t('inventory.books.adjustStock')}
                    </button>
                    <button type="button" onClick={() => handleToggleActive(book)}>
                      {book.is_active ? t('inventory.books.deactivate') : t('inventory.books.activate')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <BookFormModal
          mode="create"
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={afterSave}
        />
      )}
      {editingBook && (
        <BookFormModal
          mode="edit"
          book={editingBook}
          categories={categories}
          onClose={() => setEditingBook(null)}
          onSaved={afterSave}
        />
      )}
      {adjustingBook && (
        <StockAdjustModal
          book={adjustingBook}
          onClose={() => setAdjustingBook(null)}
          onSaved={afterAdjust}
        />
      )}
    </div>
  )
}
