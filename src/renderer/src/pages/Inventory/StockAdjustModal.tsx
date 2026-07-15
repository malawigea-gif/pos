import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book, StockAdjustReason } from '@shared/inventory'
import { Modal } from '../../components/Modal/Modal'
import { useDescribeError } from '../../lib/ipcError'
import formStyles from '../../components/Form/formStyles.module.css'

interface StockAdjustModalProps {
  book: Book
  onClose: () => void
  onSaved: () => void
}

export function StockAdjustModal({ book, onClose, onSaved }: StockAdjustModalProps): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const [changeQty, setChangeQty] = useState('0')
  const [reason, setReason] = useState<StockAdjustReason>('adjustment')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const qty = Number(changeQty)
    if (!qty) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    try {
      await window.api.inventory.adjustStock({
        bookId: book.id,
        changeQty: qty,
        reason,
        notes: notes.trim() || undefined
      })
      onSaved()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('inventory.stockAdjust.title', { title: book.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={formStyles.buttonSecondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="stock-adjust-form"
            className={formStyles.buttonPrimary}
            disabled={saving}
          >
            {t('inventory.stockAdjust.submit')}
          </button>
        </>
      }
    >
      <form id="stock-adjust-form" onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <p className={formStyles.hint}>
          {t('inventory.stockAdjust.currentStock', { qty: book.stock_qty })}
        </p>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.stockAdjust.quantityChange')}</label>
          <input
            className={formStyles.input}
            type="number"
            value={changeQty}
            onChange={(e) => setChangeQty(e.target.value)}
            autoFocus
          />
          <p className={formStyles.hint}>{t('inventory.stockAdjust.quantityChangeHint')}</p>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.stockAdjust.reason')}</label>
          <select
            className={formStyles.select}
            value={reason}
            onChange={(e) => setReason(e.target.value as StockAdjustReason)}
          >
            <option value="adjustment">{t('inventory.stockAdjust.reasons.adjustment')}</option>
            <option value="write_off">{t('inventory.stockAdjust.reasons.write_off')}</option>
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('inventory.stockAdjust.notes')}</label>
          <input className={formStyles.input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}
