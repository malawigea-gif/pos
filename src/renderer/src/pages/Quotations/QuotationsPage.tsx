import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreateQuotationTab } from './CreateQuotationTab'
import { QuotationsListTab } from './QuotationsListTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'create' | 'list'

const TABS: Tab[] = ['create', 'list']

export function QuotationsPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('create')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.quotations } as React.CSSProperties}>
      <h1 className={styles.title}>{t('quotations.title')}</h1>

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
            {t(`quotations.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'create' ? (
          <CreateQuotationTab onSaved={() => setTab('list')} />
        ) : (
          <QuotationsListTab />
        )}
      </div>
    </div>
  )
}
