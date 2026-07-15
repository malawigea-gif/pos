import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BooksTab } from './BooksTab'
import { StockTakeTab } from './StockTakeTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'books' | 'stockTake'

const TABS: Tab[] = ['books', 'stockTake']

export function InventoryPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('books')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.inventory } as React.CSSProperties}>
      <h1 className={styles.title}>{t('inventory.title')}</h1>

      <div className={styles.tabs} role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? styles.tabActive : styles.tab}
            onClick={() => setTab(key)}
          >
            {t(`inventory.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>{tab === 'books' ? <BooksTab /> : <StockTakeTab />}</div>
    </div>
  )
}
