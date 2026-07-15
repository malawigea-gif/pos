import { useTranslation } from 'react-i18next'
import { setLanguageAndPersist, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n'
import type { AppPage } from '../../App'
import { useSession } from '../../session/SessionContext'
import type { UserRole } from '@shared/users'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import { TAB_ICONS } from '../../theme/tabIcons'
import styles from './TopBar.module.css'

interface TopBarProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
}

const ALL_PAGES: AppPage[] = [
  'sales',
  'quotations',
  'returns',
  'inventory',
  'customers',
  'suppliers',
  'pricing',
  'reports',
  'users',
  'backup',
  'auditLog',
  'settings'
]

// Mirrors the spec's own role descriptions: Cashier = billing/sales,
// payment collection, returns (creation only — approval is gated at the
// IPC layer, not here); Manager adds inventory/suppliers/pricing(read)/
// reports; Admin adds user management, backup/recovery, and the audit log.
const ROLE_PAGES: Record<UserRole, AppPage[]> = {
  cashier: ['sales', 'quotations', 'returns', 'customers', 'settings'],
  manager: [
    'sales',
    'quotations',
    'returns',
    'inventory',
    'customers',
    'suppliers',
    'pricing',
    'reports',
    'settings'
  ],
  admin: ALL_PAGES
}

export function TopBar({ currentPage, onNavigate }: TopBarProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const { session, setSession } = useSession()
  const activeLanguage = i18n.language as SupportedLanguage
  const visiblePages = session ? ROLE_PAGES[session.role] : []

  async function handleLogout(): Promise<void> {
    if (!window.confirm(t('session.confirmLogout'))) return
    await window.api.session.logout()
    setSession(null)
  }

  return (
    <header className={styles.bar}>
      <span className={styles.appName}>{t('common.appName')}</span>

      <nav className={styles.nav}>
        {visiblePages.map((page) => {
          const Icon = TAB_ICONS[page]
          return (
            <button
              key={page}
              type="button"
              className={currentPage === page ? styles.navButtonActive : styles.navButton}
              style={{ '--tab-accent': TAB_ACCENT_COLORS[page] } as React.CSSProperties}
              onClick={() => onNavigate(page)}
            >
              <Icon className={styles.navIcon} size={22} aria-hidden="true" />
              {t(`topbar.${page}`)}
            </button>
          )
        })}
      </nav>

      <div className={styles.rightGroup}>
        <div className={styles.languageSwitcher} role="radiogroup" aria-label={t('topbar.language')}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={activeLanguage === lang}
              className={activeLanguage === lang ? styles.langButtonActive : styles.langButton}
              onClick={() => setLanguageAndPersist(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {session && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {session.fullName} · {t(`users.roles.${session.role}`)}
            </span>
            <button type="button" className={styles.logoutButton} onClick={handleLogout}>
              {t('session.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
