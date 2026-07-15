import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReceiptData, ReceiptPaperSize } from '@shared/sales'
import { RECEIPT_LABELS } from '@shared/receiptLabels'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './ReceiptModal.module.css'

interface ReceiptModalProps {
  data: ReceiptData
  onClose: () => void
}

const PAPER_SIZES: ReceiptPaperSize[] = ['80mm', 'a4', 'a5']
const PAPER_SIZE_LABEL_KEYS: Record<ReceiptPaperSize, string> = {
  '80mm': 'sales.receiptModal.paperSizeThermal',
  a4: 'sales.receiptModal.paperSizeA4',
  a5: 'sales.receiptModal.paperSizeA5'
}

export function ReceiptModal({ data, onClose }: ReceiptModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const labels = RECEIPT_LABELS[data.language]
  const isQuotation = data.documentType === 'quotation'
  const docLabel = isQuotation ? labels.quotationNo : labels.invoiceNo

  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>('80mm')

  async function handleExportPdf(): Promise<void> {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const path = await window.api.sales.exportReceiptPdf(data, paperSize)
      if (path) setStatus(t('sales.receiptModal.pdfSaved', { path }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePrintThermal(): Promise<void> {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await window.api.sales.printReceiptThermal(data)
      setStatus(t('sales.receiptModal.printSuccess'))
    } catch {
      setError(t('sales.receiptModal.printerUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('sales.receiptModal.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={handleExportPdf} disabled={busy}>
            {t('sales.receiptModal.exportPdf')}
          </button>
          {paperSize === '80mm' && (
            <button
              type="button"
              className={formStyles.buttonSecondary}
              onClick={handlePrintThermal}
              disabled={busy}
            >
              {t('sales.receiptModal.printThermal')}
            </button>
          )}
          <button type="button" className={formStyles.buttonPrimary} onClick={onClose}>
            {t('sales.receiptModal.newSale')}
          </button>
        </>
      }
    >
      {error && <div className={formStyles.error}>{error}</div>}
      {status && <div className={styles.status}>{status}</div>}

      <div className={formStyles.field}>
        <label className={formStyles.label}>{t('sales.receiptModal.paperSize')}</label>
        <div
          className={styles.paperSizeOptions}
          role="radiogroup"
          aria-label={t('sales.receiptModal.paperSize')}
        >
          {PAPER_SIZES.map((size) => (
            <label key={size} className={styles.paperSizeOption}>
              <input
                type="radio"
                name="paperSize"
                value={size}
                checked={paperSize === size}
                onChange={() => setPaperSize(size)}
              />
              {t(PAPER_SIZE_LABEL_KEYS[size])}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.receipt}>
        <h2 className={styles.center}>{data.businessName}</h2>
        {data.address && <p className={styles.centerMuted}>{data.address}</p>}
        {(data.phone || data.email) && (
          <p className={styles.centerMuted}>{[data.phone, data.email].filter(Boolean).join(' · ')}</p>
        )}
        <hr />
        <h3 className={styles.center}>
          {docLabel}: {data.invoiceNo}
        </h3>
        {isQuotation && (
          <p className={styles.centerMuted}>
            {labels.notTaxInvoice}
            {data.validUntil && ` — ${labels.validUntil} ${new Date(data.validUntil).toLocaleDateString()}`}
          </p>
        )}
        <p className={styles.centerMuted}>{new Date(data.saleDate).toLocaleString()}</p>
        <p className={styles.centerMuted}>
          {labels.cashier}: {data.cashierName}
        </p>
        <hr />
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>{labels.item}</th>
              <th className={styles.num}>{labels.qty}</th>
              <th className={styles.num}>{labels.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                <td>{item.title}</td>
                <td className={styles.num}>{item.quantity}</td>
                <td className={styles.num}>{item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div className={styles.totalsRow}>
          <span>{labels.subtotal}</span>
          <span>{data.subtotal.toFixed(2)}</span>
        </div>
        {data.discountTotal > 0 && (
          <div className={styles.totalsRow}>
            <span>{labels.discount}</span>
            <span>-{data.discountTotal.toFixed(2)}</span>
          </div>
        )}
        {data.taxTotal > 0 && (
          <div className={styles.totalsRow}>
            <span>{labels.tax}</span>
            <span>{data.taxTotal.toFixed(2)}</span>
          </div>
        )}
        <div className={styles.grandTotal}>
          <span>{labels.grandTotal}</span>
          <span>{data.total.toFixed(2)}</span>
        </div>
        {!isQuotation && (
          <>
            <hr />
            {data.payments.map((payment, index) => (
              <div key={index} className={styles.totalsRow}>
                <span>{payment.method}</span>
                <span>{payment.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className={styles.totalsRow}>
              <span>{labels.paid}</span>
              <span>{data.amountPaid.toFixed(2)}</span>
            </div>
            {data.change > 0 && (
              <div className={styles.totalsRow}>
                <span>{labels.change}</span>
                <span>{data.change.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
        <p className={styles.centerMuted}>{labels.thankYou}</p>
      </div>
    </Modal>
  )
}
