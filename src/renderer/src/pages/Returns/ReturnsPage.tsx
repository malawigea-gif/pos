import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProcessReturnTab } from './ProcessReturnTab'
import { PendingApprovalsTab } from './PendingApprovalsTab'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import styles from '../../components/TabbedPage/tabbedPage.module.css'

type Tab = 'process' | 'pending'

const TABS: Tab[] = ['process', 'pending']

export function ReturnsPage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('process')

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.returns } as React.CSSProperties}>
      <h1 className={styles.title}>{t('returns.title')}</h1>

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
            {t(`returns.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.content}>{tab === 'process' ? <ProcessReturnTab /> : <PendingApprovalsTab />}</div>
    </div>
  )
}
