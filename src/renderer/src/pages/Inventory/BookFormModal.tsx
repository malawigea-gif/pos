import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import type { TaxRate } from '@shared/pricing'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface BookFormModalProps {
  mode: 'create' | 'edit'
  book?: Book
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  title: string
  author: string
  publisher: string
  brand: string
  isbn: string
  barcode: string
  category: string
  language: string
  taxRateId: string
  costPrice: string
  sellingPrice: string
  initialStockQty: string
  reorderLevel: string
  shelfLocation: string
}

function toFormState(book?: Book, categoryName?: string): FormState {
  return {
    title: book?.title ?? '',
    author: book?.author ?? '',
    publisher: book?.publisher ?? '',
    brand: book?.brand ?? '',
    isbn: book?.isbn ?? '',
    barcode: book?.barcode ?? '',
    category: categoryName ?? '',
    language: book?.language ?? '',
    taxRateId: book?.tax_rate_id != null ? String(book.tax_rate_id) : '',
    costPrice: book ? String(book.cost_price) : '0',
    sellingPrice: book ? String(book.selling_price) : '0',
    initialStockQty: '0',
    reorderLevel: book ? String(book.reorder_level) : '0',
    shelfLocation: book?.shelf_location ?? ''
  }
}

export function BookFormModal({
  mode,
  book,
  categories,
  onClose,
  onSaved
}: BookFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const existingCategoryName = categories.find((c) => c.id === book?.category_id)?.name
  const [form, setForm] = useState<FormState>(() => toFormState(book, existingCategoryName))
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.pricing.listTaxRates().then(setTaxRates)
  }, [])

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function buildCategoryFields(): { categoryId?: number | null; categoryName?: string | null } {
    const trimmed = form.category.trim()
    if (!trimmed) return { categoryId: null }
    const existing = categories.find((c) => c.name === trimmed)
    return existing ? { categoryId: existing.id } : { categoryName: trimmed }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.title.trim()) {
      setError(t('inventory.form.titleRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const shared = {
        isbn: form.isbn.trim() || null,
        barcode: form.barcode.trim() || null,
        title: form.title.trim(),
        author: form.author.trim() || null,
        publisher: form.publisher.trim() || null,
        brand: form.brand.trim() || null,
        language: form.language.trim() || null,
        taxRateId: form.taxRateId ? Number(form.taxRateId) : null,
        costPrice: Number(form.costPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        shelfLocation: form.shelfLocation.trim() || null,
        ...buildCategoryFields()
      }

      if (mode === 'create') {
        await window.api.inventory.createBook({
          ...shared,
          initialStockQty: Number(form.initialStockQty) || 0
        })
      } else if (book) {
        await window.api.inventory.updateBook(book.id, shared)
      }
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? t('inventory.books.addBook') : t('inventory.books.editBook')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="book-form"
            className={formStyles.buttonPrimary}
            disabled={saving}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="book-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.form.title')}</label>
          <input
            className={formStyles.input}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            autoFocus
          />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.author')}</label>
            <input
              className={formStyles.input}
              value={form.author}
              onChange={(e) => update('author', e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.publisher')}</label>
            <input
              className={formStyles.input}
              value={form.publisher}
              onChange={(e) => update('publisher', e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.brand')}</label>
            <input
              className={formStyles.input}
              value={form.brand}
              onChange={(e) => update('brand', e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.isbn')}</label>
            <input
              className={formStyles.input}
              value={form.isbn}
              onChange={(e) => update('isbn', e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.barcode')}</label>
            <input
              className={formStyles.input}
              value={form.barcode}
              onChange={(e) => update('barcode', e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.category')}</label>
            <input
              className={formStyles.input}
              list="category-options"
              placeholder={t('inventory.form.categoryPlaceholder')}
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.language')}</label>
            <input
              className={formStyles.input}
              value={form.language}
              onChange={(e) => update('language', e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.form.taxRate')}</label>
          <select
            className={formStyles.select}
            value={form.taxRateId}
            onChange={(e) => update('taxRateId', e.target.value)}
          >
            <option value="">{t('inventory.form.taxRateNone')}</option>
            {taxRates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {rate.name} ({rate.is_exempt ? t('pricing.taxRates.exempt') : `${rate.rate_percent}%`})
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.costPrice')}</label>
            <input
              className={formStyles.input}
              type="number"
              step="0.01"
              min="0"
              value={form.costPrice}
              onChange={(e) => update('costPrice', e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.sellingPrice')}</label>
            <input
              className={formStyles.input}
              type="number"
              step="0.01"
              min="0"
              value={form.sellingPrice}
              onChange={(e) => update('sellingPrice', e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          {mode === 'create' && (
            <div className={formStyles.field}>
              <label className={formStyles.label}>{t('inventory.form.initialStockQty')}</label>
              <input
                className={formStyles.input}
                type="number"
                min="0"
                value={form.initialStockQty}
                onChange={(e) => update('initialStockQty', e.target.value)}
              />
            </div>
          )}
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('inventory.form.reorderLevel')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="0"
              value={form.reorderLevel}
              onChange={(e) => update('reorderLevel', e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.form.shelfLocation')}</label>
          <input
            className={formStyles.input}
            value={form.shelfLocation}
            onChange={(e) => update('shelfLocation', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
