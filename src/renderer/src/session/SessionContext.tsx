import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SessionInfo } from '@shared/session'

interface SessionContextValue {
  session: SessionInfo | null
  setSession: (session: SessionInfo | null) => void
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<SessionInfo | null>(null)
  return <SessionContext.Provider value={{ session, setSession }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
