import { useCallback, useEffect, useState } from 'react'
import { TopBar } from './components/TopBar/TopBar'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { InventoryPage } from './pages/Inventory/InventoryPage'
import { SalesPage } from './pages/Sales/SalesPage'
import { QuotationsPage } from './pages/Quotations/QuotationsPage'
import { CustomersPage } from './pages/Customers/CustomersPage'
import { SuppliersPage } from './pages/Suppliers/SuppliersPage'
import { PricingPage } from './pages/Pricing/PricingPage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { ReturnsPage } from './pages/Returns/ReturnsPage'
import { UsersPage } from './pages/Users/UsersPage'
import { BackupPage } from './pages/Backup/BackupPage'
import { AuditLogPage } from './pages/AuditLog/AuditLogPage'
import { LoginScreen } from './session/LoginScreen'
import { LockScreen } from './session/LockScreen'
import { useSession } from './session/SessionContext'
import { useIdleLock } from './session/useIdleLock'
import { setLanguage } from './i18n'

export type AppPage =
  | 'sales'
  | 'quotations'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'pricing'
  | 'reports'
  | 'returns'
  | 'users'
  | 'backup'
  | 'auditLog'
  | 'settings'

function App(): JSX.Element {
  const { session, setSession } = useSession()
  const [page, setPage] = useState<AppPage>('sales')
  const [idleTimeoutMinutes, setIdleTimeoutMinutesState] = useState(15)
  const [checkingSession, setCheckingSession] = useState(true)

  // A session can already exist in main (e.g. a dev hot-reload remounted
  // the renderer) even though this component's local state starts fresh.
  useEffect(() => {
    window.api.session.getCurrent().then((current) => {
      if (current) {
        setSession(current)
        setLanguage(current.language)
      }
      setCheckingSession(false)
    })
  }, [setSession])

  useEffect(() => {
    if (session) {
      window.api.session.getIdleTimeoutMinutes().then(setIdleTimeoutMinutesState)
    }
  }, [session?.userId])

  const handleIdle = useCallback(async () => {
    await window.api.session.lock()
    const current = await window.api.session.getCurrent()
    setSession(current)
  }, [setSession])

  useIdleLock(idleTimeoutMinutes, handleIdle, Boolean(session) && !session?.locked)

  async function handleLoggedIn(): Promise<void> {
    const current = await window.api.session.getCurrent()
    if (current) {
      setSession(current)
      setLanguage(current.language)
      setPage('sales')
    }
  }

  async function handleUnlocked(): Promise<void> {
    const current = await window.api.session.getCurrent()
    setSession(current)
  }

  if (checkingSession) return <></>

  if (!session) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />
  }

  if (session.locked) {
    return <LockScreen fullName={session.fullName} onUnlocked={handleUnlocked} />
  }

  return (
    <div>
      <TopBar currentPage={page} onNavigate={setPage} />
      {page === 'sales' && <SalesPage />}
      {page === 'quotations' && <QuotationsPage />}
      {page === 'inventory' && <InventoryPage />}
      {page === 'customers' && <CustomersPage />}
      {page === 'suppliers' && <SuppliersPage />}
      {page === 'pricing' && <PricingPage />}
      {page === 'reports' && <ReportsPage />}
      {page === 'returns' && <ReturnsPage />}
      {page === 'users' && <UsersPage />}
      {page === 'backup' && <BackupPage />}
      {page === 'auditLog' && <AuditLogPage />}
      {page === 'settings' && <SettingsPage />}
    </div>
  )
}

export default App
