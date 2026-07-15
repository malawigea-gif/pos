import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Quotation } from '@shared/quotations'
import type { Customer } from '@shared/customers'
import type { ReceiptData } from '@shared/sales'
import type { ReceiptLanguage } from '@shared/receiptLabels'
import { useDescribeError } from '../../lib/ipcError'
import { ReceiptModal } from '../Sales/ReceiptModal'
import { ConvertToSaleModal } from './ConvertToSaleModal'
import formStyles from '../../components/Form/formStyles.module.css'
import tableStyles from '../../components/DataTable/dataTable.module.css'

export function QuotationsListTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const describeError = useDescribeError()
  const uiLanguage = i18n.language as ReceiptLanguage

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customerNames, setCustomerNames] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [convertingQuotation, setConvertingQuotation] = useState<Quotation | null>(null)

  async function load(): Promise<void> {
    try {
      const [list, customers] = await Promise.all([
        window.api.quotations.list(),
        window.api.customers.list()
      ])
      setQuotations(list)
      setCustomerNames(new Map(customers.map((c: Customer) => [c.id, c.name])))
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleViewPrint(quotationId: number): Promise<void> {
    setError(null)
    try {
      const data = await window.api.quotations.getReceiptData(quotationId, uiLanguage)
      if (data) setReceiptData(data)
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleVoid(quotationId: number): Promise<void> {
    if (!window.confirm(t('quotations.actions.confirmVoid'))) return
    setError(null)
    try {
      await window.api.quotations.void(quotationId)
      await load()
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div>
      {error && <div className={formStyles.error}>{error}</div>}

      {quotations.length === 0 ? (
        <p>{t('quotations.noResults')}</p>
      ) : (
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>{t('quotations.table.quoteNo')}</th>
              <th>{t('quotations.table.status')}</th>
              <th>{t('quotations.table.customer')}</th>
              <th>{t('quotations.table.total')}</th>
              <th>{t('quotations.table.validUntil')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => (
              <tr key={q.id}>
                <td>{q.quote_no}</td>
                <td>{t(`quotations.status.${q.status}`)}</td>
                <td>{q.customer_id !== null ? customerNames.get(q.customer_id) ?? '—' : '—'}</td>
                <td>{q.total.toFixed(2)}</td>
                <td>{q.valid_until ?? '—'}</td>
                <td className={tableStyles.actionsCell}>
                  <button type="button" onClick={() => handleViewPrint(q.id)}>
                    {t('quotations.actions.viewPrint')}
                  </button>
                  {q.status === 'open' && (
                    <>
                      <button type="button" onClick={() => setConvertingQuotation(q)}>
                        {t('quotations.actions.convertToSale')}
                      </button>
                      <button type="button" onClick={() => handleVoid(q.id)}>
                        {t('quotations.actions.void')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {receiptData && <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}

      {convertingQuotation && (
        <ConvertToSaleModal
          quotation={convertingQuotation}
          uiLanguage={uiLanguage}
          onClose={() => setConvertingQuotation(null)}
          onComplete={(data) => {
            setConvertingQuotation(null)
            setReceiptData(data)
            load()
          }}
        />
      )}
    </div>
  )
}
