import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, Category } from '@shared/inventory'
import type { ComboOffer } from '@shared/pricing'
import { useDescribeError } from '../../lib/ipcError'
import { ComboOfferFormModal } from './ComboOfferFormModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function ComboOffersTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [comboOffers, setComboOffers] = useState<ComboOffer[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ComboOffer | null>(null)

  async function load(): Promise<void> {
    try {
      const [comboList, bookList, categoryList] = await Promise.all([
        window.api.pricing.listComboOffers(),
        window.api.inventory.listBooks(),
        window.api.inventory.listCategories()
      ])
      setComboOffers(comboList)
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

  function scopeLabel(combo: ComboOffer): string {
    if (combo.scope === 'item') {
      return books.find((b) => b.id === combo.book_id)?.title ?? t('pricing.discounts.scopes.item')
    }
    return categories.find((c) => c.id === combo.category_id)?.name ?? t('pricing.discounts.scopes.category')
  }

  async function toggleActive(combo: ComboOffer): Promise<void> {
    try {
      await window.api.pricing.setComboOfferActive(combo.id, !combo.is_active)
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
          {t('pricing.comboOffers.add')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {comboOffers.length === 0 ? (
        <p>{t('pricing.comboOffers.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('pricing.comboOffers.table.name')}</th>
              <th>{t('pricing.comboOffers.table.buyFree')}</th>
              <th>{t('pricing.comboOffers.table.scope')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {comboOffers.map((combo) => (
              <tr key={combo.id} className={combo.is_active ? undefined : styles.inactiveRow}>
                <td>{combo.name}</td>
                <td>
                  {combo.buy_quantity} / {combo.free_quantity}
                </td>
                <td>{scopeLabel(combo)}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => setEditing(combo)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => toggleActive(combo)}>
                    {combo.is_active ? t('pricing.comboOffers.deactivate') : t('pricing.comboOffers.activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <ComboOfferFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />
      )}
      {editing && (
        <ComboOfferFormModal
          mode="edit"
          comboOffer={editing}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
