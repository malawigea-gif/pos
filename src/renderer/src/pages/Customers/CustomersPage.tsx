import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CustomersTab } from './CustomersTab'
import { PreordersTab } from './PreordersTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'customers' | 'preorders'

const TABS: Tab[] = ['customers', 'preorders']

export function CustomersPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('customers')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.customers } as React.CSSProperties}>
      <h1 className={styles.title}>{t('customers.title')}</h1>

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
            {t(`customers.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>{tab === 'customers' ? <CustomersTab /> : <PreordersTab />}</div>
    </div>
  )
}
