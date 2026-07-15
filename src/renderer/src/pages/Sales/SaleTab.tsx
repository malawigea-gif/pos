import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReceiptData } from '@shared/sales'
import type { ReceiptLanguage } from '@shared/receiptLabels'
import type { Customer } from '@shared/customers'
import { useDescribeError } from '../../lib/ipcError'
import { HeldSalesModal } from './HeldSalesModal'
import { PaymentModal } from './PaymentModal'
import { ReceiptModal } from './ReceiptModal'
import { ReprintModal } from './ReprintModal'
import { ItemSearchCart } from '../../components/ItemSearchCart/ItemSearchCart'
import { CustomerSelect } from '../../components/CustomerSelect/CustomerSelect'
import type { CartLine } from './types'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from './SaleTab.module.css'

export function SaleTab(): JSX.Element {
  const { t, i18n } = useTranslation()
  const describeError = useDescribeError()

  const [cart, setCart] = useState<CartLine[]>([])
  const [heldSaleId, setHeldSaleId] = useState<number | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [showHeldPicker, setShowHeldPicker] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showReprint, setShowReprint] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  function clearCart(): void {
    setCart([])
    setHeldSaleId(null)
    setSelectedCustomer(null)
  }

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  async function handleHold(): Promise<void> {
    setError(null)
    try {
      await window.api.sales.hold({
        items: cart.map((line) => ({ bookId: line.bookId, quantity: line.quantity, unitPrice: line.unitPrice })),
        customerId: selectedCustomer?.id
      })
      clearCart()
      setNotice(t('sales.cart.heldCleared'))
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function handleResume(saleId: number, items: CartLine[], customerId: number | null): Promise<void> {
    setCart(items)
    setHeldSaleId(saleId)
    setSelectedCustomer(customerId !== null ? ((await window.api.customers.get(customerId)) ?? null) : null)
    setShowHeldPicker(false)
  }

  async function handleCheckoutComplete(data: ReceiptData): Promise<void> {
    clearCart()
    setShowPayment(false)
    setReceiptData(data)
  }

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {error && <div className={formStyles.error}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        <ItemSearchCart cart={cart} setCart={setCart} />
      </div>

      <div className={styles.summary}>
        <CustomerSelect customer={selectedCustomer} onChange={setSelectedCustomer} />

        <div className={styles.totalRow}>
          <span>{t('sales.cart.total')}</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>

        <button
          type="button"
          className={formStyles.buttonPrimary}
          disabled={cart.length === 0}
          onClick={() => setShowPayment(true)}
        >
          {t('sales.cart.checkout')}
        </button>
        <button
          type="button"
          className={formStyles.buttonSecondary}
          disabled={cart.length === 0 || heldSaleId !== null}
          onClick={handleHold}
        >
          {t('sales.cart.hold')}
        </button>
        <button type="button" className={formStyles.buttonSecondary} onClick={() => setShowHeldPicker(true)}>
          {t('sales.cart.resumeHeld')}
        </button>
        <button type="button" className={formStyles.buttonSecondary} onClick={() => setShowReprint(true)}>
          {t('sales.reprint.title')}
        </button>
      </div>

      {showHeldPicker && (
        <HeldSalesModal onClose={() => setShowHeldPicker(false)} onResume={handleResume} />
      )}

      {showPayment && (
        <PaymentModal
          total={subtotal}
          heldSaleId={heldSaleId ?? undefined}
          items={
            heldSaleId === null
              ? cart.map((line) => ({ bookId: line.bookId, quantity: line.quantity, unitPrice: line.unitPrice }))
              : undefined
          }
          customer={selectedCustomer}
          uiLanguage={i18n.language as ReceiptLanguage}
          onClose={() => setShowPayment(false)}
          onComplete={handleCheckoutComplete}
        />
      )}

      {receiptData && <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}

      {showReprint && (
        <ReprintModal uiLanguage={i18n.language as ReceiptLanguage} onClose={() => setShowReprint(false)} />
      )}
    </div>
  )
}
