import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaxRate } from '@shared/pricing'
import { useDescribeError } from '../../lib/ipcError'
import { TaxRateFormModal } from './TaxRateFormModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'

export function TaxRatesTab(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()

  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)

  async function load(): Promise<void> {
    try {
      setTaxRates(await window.api.pricing.listTaxRates())
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleActive(rate: TaxRate): Promise<void> {
    try {
      await window.api.pricing.setTaxRateActive(rate.id, !rate.is_active)
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
          {t('pricing.taxRates.add')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {taxRates.length === 0 ? (
        <p>{t('pricing.taxRates.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('pricing.taxRates.table.name')}</th>
              <th>{t('pricing.taxRates.table.rate')}</th>
              <th>{t('pricing.taxRates.table.default')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {taxRates.map((rate) => (
              <tr key={rate.id} className={rate.is_active ? undefined : styles.inactiveRow}>
                <td>{rate.name}</td>
                <td>{rate.is_exempt ? t('pricing.taxRates.exempt') : `${rate.rate_percent}%`}</td>
                <td>{rate.is_default ? t('common.yes') : t('common.no')}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => setEditing(rate)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => toggleActive(rate)}>
                    {rate.is_active ? t('pricing.taxRates.deactivate') : t('pricing.taxRates.activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <TaxRateFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />}
      {editing && (
        <TaxRateFormModal mode="edit" taxRate={editing} onClose={() => setEditing(null)} onSaved={afterSave} />
      )}
    </div>
  )
}
