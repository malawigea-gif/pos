import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import type { ComboOffer, ComboScope } from '@shared/pricing'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface ComboOfferFormModalProps {
  mode: 'create' | 'edit'
  comboOffer?: ComboOffer
  onClose: () => void
  onSaved: () => void
}

export function ComboOfferFormModal({
  mode,
  comboOffer,
  onClose,
  onSaved
}: ComboOfferFormModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState(comboOffer?.name ?? '')
  const [buyQuantity, setBuyQuantity] = useState(comboOffer ? String(comboOffer.buy_quantity) : '2')
  const [freeQuantity, setFreeQuantity] = useState(comboOffer ? String(comboOffer.free_quantity) : '1')
  const [scope, setScope] = useState<ComboScope>(comboOffer?.scope ?? 'item')
  const [bookId, setBookId] = useState(comboOffer?.book_id ? String(comboOffer.book_id) : '')
  const [categoryId, setCategoryId] = useState(comboOffer?.category_id ? String(comboOffer.category_id) : '')
  const [startsAt, setStartsAt] = useState(comboOffer?.starts_at?.slice(0, 10) ?? '')
  const [endsAt, setEndsAt] = useState(comboOffer?.ends_at?.slice(0, 10) ?? '')
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
        buyQuantity: Number(buyQuantity) || 1,
        freeQuantity: Number(freeQuantity) || 0,
        scope,
        bookId: scope === 'item' && bookId ? Number(bookId) : null,
        categoryId: scope === 'category' && categoryId ? Number(categoryId) : null,
        startsAt: startsAt || null,
        endsAt: endsAt || null
      }
      if (mode === 'create') {
        await window.api.pricing.createComboOffer(input)
      } else if (comboOffer) {
        await window.api.pricing.updateComboOffer(comboOffer.id, input)
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
      title={mode === 'create' ? t('pricing.comboOffers.add') : t('pricing.comboOffers.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="combo-offer-form"
            className={formStyles.buttonPrimary}
            disabled={saving}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="combo-offer-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}
        <p className={formStyles.hint}>{t('pricing.comboOffers.hint')}</p>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('pricing.comboOffers.name')}</label>
          <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.comboOffers.buyQuantity')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="1"
              value={buyQuantity}
              onChange={(e) => setBuyQuantity(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.comboOffers.freeQuantity')}</label>
            <input
              className={formStyles.input}
              type="number"
              min="1"
              value={freeQuantity}
              onChange={(e) => setFreeQuantity(e.target.value)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('pricing.comboOffers.scope')}</label>
          <select
            className={formStyles.select}
            value={scope}
            onChange={(e) => setScope(e.target.value as ComboScope)}
          >
            <option value="item">{t('pricing.discounts.scopes.item')}</option>
            <option value="category">{t('pricing.discounts.scopes.category')}</option>
          </select>
        </div>

        {scope === 'item' && (
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.comboOffers.book')}</label>
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
            <label className={formStyles.label}>{t('pricing.comboOffers.category')}</label>
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
            <label className={formStyles.label}>{t('pricing.comboOffers.startsAt')}</label>
            <input
              className={formStyles.input}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>{t('pricing.comboOffers.endsAt')}</label>
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
