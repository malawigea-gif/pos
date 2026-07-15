import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sale } from '@shared/sales'
import { Modal } from '../../components/Modal/Modal'
import formStyles from '../../components/Form/formStyles.module.css'
import type { CartLine } from './types'
import styles from './HeldSalesModal.module.css'

interface HeldSalesModalProps {
  onClose: () => void
  onResume: (saleId: number, items: CartLine[], customerId: number | null) => void
}

export function HeldSalesModal({ onClose, onResume }: HeldSalesModalProps): JSX.Element {
  const { t } = useTranslation()
  const [heldSales, setHeldSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.sales.listHeld().then((sales) => {
      setHeldSales(sales)
      setLoading(false)
    })
  }, [])

  async function handleResume(sale: Sale): Promise<void> {
    const result = await window.api.sales.getWithItems(sale.id)
    if (!result) return
    const items: CartLine[] = result.items.map((item) => ({
      bookId: item.book_id,
      title: item.book_title,
      isbn: item.book_isbn,
      unitPrice: item.unit_price,
      quantity: item.quantity
    }))
    onResume(sale.id, items, result.sale.customer_id)
  }

  return (
    <Modal title={t('sales.heldPicker.title')} onClose={onClose}>
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : heldSales.length === 0 ? (
        <p>{t('sales.heldPicker.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {heldSales.map((sale) => (
            <li key={sale.id} className={styles.row}>
              <span className={styles.meta}>
                {new Date(sale.created_at).toLocaleString()}
                <span className={styles.muted}> — {sale.total.toFixed(2)}</span>
              </span>
              <button
                type="button"
                className={formStyles.buttonPrimary}
                onClick={() => handleResume(sale)}
              >
                {t('sales.heldPicker.resume')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
