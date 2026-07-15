import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Supplier } from '@shared/suppliers'
import { useDescribeError } from '../../lib/ipcError'
import { SupplierFormModal } from './SupplierFormModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function SuppliersTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  async function loadSuppliers(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await window.api.suppliers.list({ search: search.trim() || undefined }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadSuppliers, 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function afterSave(): void {
    setCreating(false)
    setEditingSupplier(null)
    loadSuppliers()
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={formStyles.input}
          placeholder={t('suppliers.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className={formStyles.buttonPrimary} onClick={() => setCreating(true)}>
          {t('suppliers.list.addSupplier')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : suppliers.length === 0 ? (
        <p>{t('suppliers.list.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('suppliers.list.table.name')}</th>
              <th>{t('suppliers.list.table.contactPerson')}</th>
              <th>{t('suppliers.list.table.phone')}</th>
              <th>{t('suppliers.list.table.balance')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>{supplier.name}</td>
                <td>{supplier.contact_person}</td>
                <td>{supplier.phone}</td>
                <td>{supplier.balance.toFixed(2)}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => setEditingSupplier(supplier)}>
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <SupplierFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />}
      {editingSupplier && (
        <SupplierFormModal
          mode="edit"
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
