import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/customers'
import { useDescribeError } from '../../lib/ipcError'
import { CustomerFormModal } from './CustomerFormModal'
import { CreditPaymentModal } from './CreditPaymentModal'
import { LoyaltyAdjustModal } from './LoyaltyAdjustModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function CustomersTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null)
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)

  async function loadCustomers(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      setCustomers(await window.api.customers.list({ search: search.trim() || undefined }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function afterSave(): void {
    setCreating(false)
    setEditingCustomer(null)
    setCreditCustomer(null)
    setLoyaltyCustomer(null)
    loadCustomers()
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={formStyles.input}
          placeholder={t('customers.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className={formStyles.buttonPrimary} onClick={() => setCreating(true)}>
          {t('customers.list.addCustomer')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : customers.length === 0 ? (
        <p>{t('customers.list.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('customers.list.table.name')}</th>
              <th>{t('customers.list.table.phone')}</th>
              <th>{t('customers.list.table.creditBalance')}</th>
              <th>{t('customers.list.table.loyaltyPoints')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  {customer.name}
                  {Boolean(customer.is_credit_account) && (
                    <span className={styles.badgeMuted}>{t('customers.list.creditBadge')}</span>
                  )}
                </td>
                <td>{customer.phone}</td>
                <td>{customer.credit_balance.toFixed(2)}</td>
                <td>{customer.loyalty_points}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => setEditingCustomer(customer)}>
                    {t('common.edit')}
                  </button>
                  {Boolean(customer.is_credit_account) && (
                    <button type="button" onClick={() => setCreditCustomer(customer)}>
                      {t('customers.list.recordPayment')}
                    </button>
                  )}
                  <button type="button" onClick={() => setLoyaltyCustomer(customer)}>
                    {t('customers.list.adjustPoints')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <CustomerFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />}
      {editingCustomer && (
        <CustomerFormModal
          mode="edit"
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={afterSave}
        />
      )}
      {creditCustomer && (
        <CreditPaymentModal
          customer={creditCustomer}
          onClose={() => setCreditCustomer(null)}
          onSaved={afterSave}
        />
      )}
      {loyaltyCustomer && (
        <LoyaltyAdjustModal
          customer={loyaltyCustomer}
          onClose={() => setLoyaltyCustomer(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
