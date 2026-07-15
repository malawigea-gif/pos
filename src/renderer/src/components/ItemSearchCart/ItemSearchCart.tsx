import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { Book } from '@shared/inventory'
import { QtyModal } from '../../pages/Sales/QtyModal'
import type { CartLine } from '../../pages/Sales/types'
import formStyles from '../Form/formStyles.module.css'
import styles from './ItemSearchCart.module.css'

interface ItemSearchCartProps {
  cart: CartLine[]
  setCart: Dispatch<SetStateAction<CartLine[]>>
}

/** Barcode-scan/search → qty-modal → cart-line UI, shared by the Sales
 *  (SaleTab) and Quotations pages so both build a cart the same way. Owns
 *  all cart-line mutation (merge-on-add, quantity edits, removal); the
 *  parent only needs to read `cart` (e.g. for a subtotal) and can drive
 *  `setCart` directly for anything else (resuming a held sale, clearing
 *  after checkout/save). */
export function ItemSearchCart({ cart, setCart }: ItemSearchCartProps): JSX.Element {
  const { t } = useTranslation()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Book[]>([])
  const [qtyModalBook, setQtyModalBook] = useState<Book | null>(null)

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const books = await window.api.inventory.listBooks({ search: search.trim() })
      setResults(books)
    }, 150)
    return () => clearTimeout(timeout)
  }, [search])

  function addToCart(book: Book, qty: number): void {
    setCart((prev) => {
      const existing = prev.find((line) => line.bookId === book.id)
      if (existing) {
        return prev.map((line) =>
          line.bookId === book.id ? { ...line, quantity: line.quantity + qty } : line
        )
      }
      return [
        ...prev,
        { bookId: book.id, title: book.title, isbn: book.isbn, unitPrice: book.selling_price, quantity: qty }
      ]
    })
    setSearch('')
    setResults([])
    searchInputRef.current?.focus()
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const term = search.trim()
    if (!term) return

    void (async () => {
      const exact = await window.api.inventory.listBooks({ search: term })
      if (exact.length === 1) {
        setQtyModalBook(exact[0])
      } else {
        setResults(exact)
      }
    })()
  }

  function updateQuantity(bookId: number, quantity: number): void {
    setCart((prev) =>
      prev.map((line) => (line.bookId === bookId ? { ...line, quantity: Math.max(1, quantity) } : line))
    )
  }

  function removeLine(bookId: number): void {
    setCart((prev) => prev.filter((line) => line.bookId !== bookId))
  }

  return (
    <>
      <div className={styles.searchBox}>
        <input
          ref={searchInputRef}
          className={formStyles.input}
          placeholder={t('sales.cart.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoFocus
        />
        {results.length > 0 && (
          <ul className={styles.resultsList}>
            {results.map((book) => (
              <li key={book.id}>
                <button type="button" onClick={() => setQtyModalBook(book)}>
                  <span>{book.title}</span>
                  <span className={styles.resultMeta}>
                    {book.isbn} · {book.selling_price.toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length === 0 ? (
        <p>{t('sales.cart.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('sales.cart.table.item')}</th>
              <th>{t('sales.cart.table.qty')}</th>
              <th>{t('sales.cart.table.price')}</th>
              <th>{t('sales.cart.table.total')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((line) => (
              <tr key={line.bookId}>
                <td>{line.title}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className={styles.qtyInput}
                    value={line.quantity}
                    onChange={(e) => updateQuantity(line.bookId, Number(e.target.value))}
                  />
                </td>
                <td>{line.unitPrice.toFixed(2)}</td>
                <td>{(line.unitPrice * line.quantity).toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => removeLine(line.bookId)}>
                    {t('sales.cart.table.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {qtyModalBook && (
        <QtyModal
          book={qtyModalBook}
          onClose={() => setQtyModalBook(null)}
          onConfirm={(book, qty) => {
            addToCart(book, qty)
            setQtyModalBook(null)
          }}
        />
      )}
    </>
  )
}
