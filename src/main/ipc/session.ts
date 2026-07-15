import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { AppLanguage, Database } from '../db/types'
import {
  getIdleTimeoutMinutes,
  getSession,
  lock,
  login,
  logout,
  setIdleTimeoutMinutes,
  touchActivity,
  unlock,
  type Session
} from '../auth/session'
import { changePassword, verifyCredentials } from '../db/repositories/usersRepository'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { ipcHandler, withRole } from './errors'
import type { LoginRequest, SessionInfo } from '../../shared/session'

const IDLE_TIMEOUT_SETTING_KEY = 'session.idleTimeoutMinutes'

function toSessionInfo(session: Session): SessionInfo {
  return {
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    role: session.role,
    language: session.language,
    locked: session.locked
  }
}

export function registerSessionIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'session:login',
    ipcHandler(async (input: LoginRequest): Promise<SessionInfo> => {
      const session = await login(db, input.username, input.password)
      return toSessionInfo(session)
    })
  )

  ipcMain.handle(
    'session:logout',
    ipcHandler(() => {
      logout()
    })
  )

  ipcMain.handle(
    'session:getCurrent',
    ipcHandler((): SessionInfo | null => {
      const session = getSession()
      return session ? toSessionInfo(session) : null
    })
  )

  ipcMain.handle(
    'session:lock',
    ipcHandler(() => {
      lock()
    })
  )

  ipcMain.handle(
    'session:unlock',
    ipcHandler(async (password: string) => {
      await unlock(db, password)
    })
  )

  ipcMain.handle(
    'session:heartbeat',
    ipcHandler(() => {
      touchActivity()
    })
  )

  ipcMain.handle(
    'session:changeOwnPassword',
    ipcHandler(async (currentPassword: string, newPassword: string) => {
      const session = getSession()
      if (!session) return
      // Re-verify the current password before allowing a self-service change.
      await verifyCredentials(db, session.username, currentPassword)
      await changePassword(db, session.userId, newPassword, session.userId)
    })
  )

  ipcMain.handle(
    'session:updateOwnLanguage',
    ipcHandler(async (language: AppLanguage) => {
      const session = getSession()
      if (!session) return
      await db
        .updateTable('users')
        .set({ language, updated_at: new Date().toISOString() })
        .where('id', '=', session.userId)
        .execute()
      session.language = language
    })
  )

  ipcMain.handle(
    'session:getIdleTimeoutMinutes',
    ipcHandler(() => getIdleTimeoutMinutes())
  )

  ipcMain.handle(
    'session:setIdleTimeoutMinutes',
    ipcHandler(
      withRole(['admin'], async (minutes: number) => {
        setIdleTimeoutMinutes(minutes)
        const session = getSession()
        await setSetting(db, IDLE_TIMEOUT_SETTING_KEY, String(minutes), session?.userId ?? null)
      })
    )
  )
}

/** Loads the persisted idle-timeout setting into the in-memory session
 *  cache at startup — called once from src/main/index.ts before the window
 *  opens, since setIdleTimeoutMinutes() itself is a synchronous, DB-free
 *  hot-path function. */
export async function loadIdleTimeoutSetting(db: Kysely<Database>): Promise<void> {
  const saved = await getSetting(db, IDLE_TIMEOUT_SETTING_KEY)
  if (saved) setIdleTimeoutMinutes(Number(saved))
}
