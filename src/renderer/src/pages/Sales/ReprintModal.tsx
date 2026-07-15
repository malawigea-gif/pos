import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sale } from '@shared/sales'
import type { ReceiptLanguage } from '@shared/receiptLabels'
import { Modal } from '../../components/Modal/Modal'
import { ReceiptModal } from './ReceiptModal'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './HeldSalesModal.module.css'

interface ReprintModalProps {
  uiLanguage: ReceiptLanguage
  onClose: () => void
}

export function ReprintModal({ uiLanguage, onClose }: ReprintModalProps): JSX.Element {
  const { t } = useTranslation()
  const [invoiceNo, setInvoiceNo] = useState('')
  const [results, setResults] = useState<Sale[]>([])
  const [searched, setSearched] = useState(false)
  const [viewingSaleId, setViewingSaleId] = useState<number | null>(null)

  async function handleSearch(): Promise<void> {
    const sales = await window.api.sales.search({ invoiceNo: invoiceNo.trim() || undefined })
    setResults(sales)
    setSearched(true)
  }

  if (viewingSaleId !== null) {
    return (
      <ReceiptModalFromSaleId
        saleId={viewingSaleId}
        uiLanguage={uiLanguage}
        onClose={() => setViewingSaleId(null)}
      />
    )
  }

  return (
    <Modal title={t('sales.reprint.title')} onClose={onClose}>
      <div className={formStyles.field}>
        <input
          className={formStyles.input}
          placeholder={t('sales.reprint.searchPlaceholder')}
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          autoFocus
        />
      </div>
      <button type="button" className={formStyles.buttonSecondary} onClick={handleSearch}>
        {t('common.search')}
      </button>

      {searched && results.length === 0 && <p>{t('sales.reprint.noResults')}</p>}

      {results.length > 0 && (
        <ul className={styles.list}>
          {results.map((sale) => (
            <li key={sale.id} className={styles.row}>
              <span className={styles.meta}>
                {sale.invoice_no}
                <span className={styles.muted}>
                  {' '}
                  — {new Date(sale.sale_date).toLocaleString()} — {sale.total.toFixed(2)}
                </span>
              </span>
              <button
                type="button"
                className={formStyles.buttonPrimary}
                onClick={() => setViewingSaleId(sale.id)}
              >
                {t('sales.reprint.view')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function ReceiptModalFromSaleId({
  saleId,
  uiLanguage,
  onClose
}: {
  saleId: number
  uiLanguage: ReceiptLanguage
  onClose: () => void
}): JSX.Element | null {
  const [data, setData] = useState<Awaited<ReturnType<typeof window.api.sales.getReceiptData>>>(undefined)

  useEffect(() => {
    window.api.sales.getReceiptData(saleId, uiLanguage).then(setData)
  }, [saleId, uiLanguage])

  if (!data) return null
  return <ReceiptModal data={data} onClose={onClose} />
}
