import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TaxRatesTab } from './TaxRatesTab'
import { DiscountsTab } from './DiscountsTab'
import { ComboOffersTab } from './ComboOffersTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'taxRates' | 'discounts' | 'comboOffers'

const TABS: Tab[] = ['taxRates', 'discounts', 'comboOffers']

export function PricingPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('taxRates')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.pricing } as React.CSSProperties}>
      <h1 className={styles.title}>{t('pricing.title')}</h1>

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
            {t(`pricing.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'taxRates' && <TaxRatesTab />}
        {tab === 'discounts' && <DiscountsTab />}
        {tab === 'comboOffers' && <ComboOffersTab />}
      </div>
    </div>
  )
}
