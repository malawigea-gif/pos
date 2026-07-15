import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book } from '@shared/inventory'
import { Modal } from '../../components/Modal/Modal'
import formStyles from '../../components/Form/formStyles.module.css'

interface QtyModalProps {
  book: Book
  onClose: () => void
  onConfirm: (book: Book, qty: number) => void
}

export function QtyModal({ book, onClose, onConfirm }: QtyModalProps): JSX.Element {
  const { t } = useTranslation()
  const [qty, setQty] = useState('1')
  const qtyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    qtyInputRef.current?.focus()
    qtyInputRef.current?.select()
  }, [])

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    onConfirm(book, Math.max(1, Number(qty) || 1))
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <Modal
      title={t('sales.cart.qtyModal.title', { title: book.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="qty-modal-form" className={formStyles.buttonPrimary}>
            {t('sales.cart.qtyModal.confirm')}
          </button>
        </>
      }
    >
      <form id="qty-modal-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('sales.cart.qtyModal.label')}</label>
          <input
            ref={qtyInputRef}
            className={formStyles.input}
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
      </form>
    </Modal>
  )
}
