import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import type { Discount } from '@shared/pricing'
import { useDescribeError } from '../../lib/ipcError'
import { DiscountFormModal } from './DiscountFormModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function DiscountsTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)

  async function load(): Promise<void> {
    try {
      const [discountList, bookList, categoryList] = await Promise.all([
        window.api.pricing.listDiscounts(),
        window.api.inventory.listBooks(),
        window.api.inventory.listCategories()
      ])
      setDiscounts(discountList)
      setBooks(bookList)
      setCategories(categoryList)
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scopeLabel(discount: Discount): string {
    if (discount.scope === 'item') {
      return books.find((b) => b.id === discount.book_id)?.title ?? t('pricing.discounts.scopes.item')
    }
    if (discount.scope === 'category') {
      return categories.find((c) => c.id === discount.category_id)?.name ?? t('pricing.discounts.scopes.category')
    }
    return t('pricing.discounts.scopes.all')
  }

  async function toggleActive(discount: Discount): Promise<void> {
    try {
      await window.api.pricing.setDiscountActive(discount.id, !discount.is_active)
      await load()
    } catch (err) {
      setError(describeError(err))
    }
  }

  function afterSave(): void {
    setCreating(false)
    setEditing(null)
    load()
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className={formStyles.buttonPrimary} onClick={() => setCreating(true)}>
          {t('pricing.discounts.add')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {discounts.length === 0 ? (
        <p>{t('pricing.discounts.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('pricing.discounts.table.name')}</th>
              <th>{t('pricing.discounts.table.type')}</th>
              <th>{t('pricing.discounts.table.value')}</th>
              <th>{t('pricing.discounts.table.scope')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount) => (
              <tr key={discount.id} className={discount.is_active ? undefined : styles.inactiveRow}>
                <td>{discount.name}</td>
                <td>{t(`pricing.discounts.types.${discount.type}`)}</td>
                <td>{discount.type === 'percent' ? `${discount.value}%` : discount.value.toFixed(2)}</td>
                <td>{scopeLabel(discount)}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => setEditing(discount)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => toggleActive(discount)}>
                    {discount.is_active ? t('pricing.discounts.deactivate') : t('pricing.discounts.activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <DiscountFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />}
      {editing && (
        <DiscountFormModal
          mode="edit"
          discount={editing}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
