import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SummaryTab } from './SummaryTab'
import { BestSellersTab } from './BestSellersTab'
import { ProfitLossTab } from './ProfitLossTab'
import { SalesByTab } from './SalesByTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'summary' | 'bestSellers' | 'profitLoss' | 'salesBy'

const TABS: Tab[] = ['summary', 'bestSellers', 'profitLoss', 'salesBy']

export function ReportsPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.reports } as React.CSSProperties}>
      <h1 className={styles.title}>{t('reports.title')}</h1>

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
            {t(`reports.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'summary' && <SummaryTab />}
        {tab === 'bestSellers' && <BestSellersTab />}
        {tab === 'profitLoss' && <ProfitLossTab />}
        {tab === 'salesBy' && <SalesByTab />}
      </div>
    </div>
  )
}
