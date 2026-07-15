import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import type { Discount, DiscountScope, DiscountType } from '@shared/pricing'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface DiscountFormModalProps {
  mode: 'create' | 'edit'
  discount?: Discount
  onClose: () => void
  onSaved: () => void
}

export function DiscountFormModal({ mode, discount, onClose, onSaved }: DiscountFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState(discount?.name ?? '')
  const [type, setType] = useState<DiscountType>(discount?.type ?? 'percent')
  const [value, setValue] = useState(discount ? String(discount.value) : '0')
  const [scope, setScope] = useState<DiscountScope>(discount?.scope ?? 'all')
  const [bookId, setBookId] = useState(discount?.book_id ? String(discount.book_id) : '')
  const [categoryId, setCategoryId] = useState(discount?.category_id ? String(discount.category_id) : '')
  const [startsAt, setStartsAt] = useState(discount?.starts_at?.slice(0, 10) ?? '')
  const [endsAt, setEndsAt] = useState(discount?.ends_at?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.inventory.listBooks().then(setBooks)
    window.api.inventory.listCategories().then(setCategories)
  }, [])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim(),
        type,
        value: Number(value) || 0,
        scope,
        bookId: bookId ? Number(bookId) : null,
        categoryId: categoryId ? Number(categoryId) : null,
        startsAt: startsAt || null,
        endsAt: endsAt || null
      }
      if (mode === 'create') {
        await window.api.pricing.createDiscount(input)
      } else if (discount) {
        await window.api.pricing.updateDiscount(discount.id, input)
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
      title={mode === 'create' ? t('pricing.discounts.add') : t('pricing.discounts.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="discount-form" className={formStyles.buttonPrimary} disabled={saving}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="discount-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('pricing.discounts.name')}</label>
          <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.type')}</label>
            <select
              className={formStyles.select}
              value={type}
              onChange={(e) => setType(e.target.value as DiscountType)}
            >
              <option value="percent">{t('pricing.discounts.types.percent')}</option>
              <option value="fixed">{t('pricing.discounts.types.fixed')}</option>
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.value')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('pricing.discounts.scope')}</label>
          <select
            className={formStyles.select}
            value={scope}
            onChange={(e) => setScope(e.target.value as DiscountScope)}
          >
            <option value="all">{t('pricing.discounts.scopes.all')}</option>
            <option value="category">{t('pricing.discounts.scopes.category')}</option>
            <option value="item">{t('pricing.discounts.scopes.item')}</option>
          </select>
        </div>

        {scope === 'item' && (
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.book')}</label>
            <select className={formStyles.select} value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">—</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === 'category' && (
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.category')}</label>
            <select
              className={formStyles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.startsAt')}</label>
            <input
              className={formStyles.input}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.discounts.endsAt')}</label>
            <input
              className={formStyles.input}
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
