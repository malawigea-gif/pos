import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SuppliersTab } from './SuppliersTab'
import { PurchaseOrdersTab } from './PurchaseOrdersTab'
import { GoodsReceivedTab } from './GoodsReceivedTab'
import { SupplierPaymentsTab } from './SupplierPaymentsTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'suppliers' | 'purchaseOrders' | 'goodsReceived' | 'payments'

const TABS: Tab[] = ['suppliers', 'purchaseOrders', 'goodsReceived', 'payments']

export function SuppliersPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('suppliers')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.suppliers } as React.CSSProperties}>
      <h1 className={styles.title}>{t('suppliers.title')}</h1>

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
            {t(`suppliers.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'suppliers' && <SuppliersTab />}
        {tab === 'purchaseOrders' && <PurchaseOrdersTab />}
        {tab === 'goodsReceived' && <GoodsReceivedTab />}
        {tab === 'payments' && <SupplierPaymentsTab />}
      </div>
    </div>
  )
}
