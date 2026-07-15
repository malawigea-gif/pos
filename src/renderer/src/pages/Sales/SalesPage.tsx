import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SaleTab } from './SaleTab'
import { RegisterClosingTab } from './RegisterClosingTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'sale' | 'registerClosing'

const TABS: Tab[] = ['sale', 'registerClosing']

export function SalesPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('sale')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.sales } as React.CSSProperties}>
      <h1 className={styles.title}>{t('sales.title')}</h1>

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
            {t(`sales.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>{tab === 'sale' ? <SaleTab /> : <RegisterClosingTab />}</div>
    </div>
  )
}
