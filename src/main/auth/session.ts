import type { Kysely } from 'kysely'
import type { AppLanguage, Database, UserRole } from '../db/types'
import { verifyCredentials } from '../db/repositories/usersRepository'

export class NotAuthenticatedError extends Error {
  constructor() {
    super('No user is signed in')
    this.name = 'NotAuthenticatedError'
  }
}

export class SessionLockedError extends Error {
  constructor() {
    super('The session is locked — enter your password to continue')
    this.name = 'SessionLockedError'
  }
}

export class ForbiddenError extends Error {
  constructor(
    public readonly role: UserRole,
    public readonly allowedRoles: UserRole[]
  ) {
    super(`Role "${role}" is not permitted to perform this action`)
    this.name = 'ForbiddenError'
  }
}

export interface Session {
  userId: number
  username: string
  fullName: string
  role: UserRole
  language: AppLanguage
  loginAt: number
  lastActivityAt: number
  locked: boolean
}

let currentSession: Session | null = null

// Configurable, but cached in memory rather than read from the settings
// table on every call — getCurrentUserId()/requireRole() run on the hot
// path of nearly every IPC handler in the app, so this stays synchronous.
// Loaded from settings at startup and updated live via setIdleTimeoutMinutes.
let idleTimeoutMinutes = 15

export function setIdleTimeoutMinutes(minutes: number): void {
  idleTimeoutMinutes = minutes
}

export function getIdleTimeoutMinutes(): number {
  return idleTimeoutMinutes
}

export async function login(db: Kysely<Database>, username: string, password: string): Promise<Session> {
  const user = await verifyCredentials(db, username, password)
  currentSession = {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    language: user.language,
    loginAt: Date.now(),
    lastActivityAt: Date.now(),
    locked: false
  }
  return currentSession
}

export function logout(): void {
  currentSession = null
}

export function getSession(): Session | null {
  return currentSession
}

export function lock(): void {
  if (currentSession) currentSession.locked = true
}

/** Re-verifies the *current* session's own password — this resumes the
 *  same session rather than starting a new one, matching "auto-lock",
 *  not "log out". */
export async function unlock(db: Kysely<Database>, password: string): Promise<void> {
  if (!currentSession) throw new NotAuthenticatedError()
  await verifyCredentials(db, currentSession.username, password)
  currentSession.locked = false
  currentSession.lastActivityAt = Date.now()
}

/** For the renderer's activity heartbeat — deliberately silent/no-op if
 *  there's no session or it's already locked, unlike getCurrentUserId. */
export function touchActivity(): void {
  if (currentSession && !currentSession.locked) currentSession.lastActivityAt = Date.now()
}

function checkIdleAndMaybeLock(): void {
  if (!currentSession || currentSession.locked) return
  const idleMs = Date.now() - currentSession.lastActivityAt
  if (idleMs > idleTimeoutMinutes * 60_000) {
    currentSession.locked = true
  }
}

/** The real replacement for the old getDefaultUserId() placeholder used
 *  throughout every module built before this one — also enforces the idle
 *  lock lazily, so even if the renderer's own idle timer never fires, the
 *  very next privileged action still gets caught and locked here. */
export function getCurrentUserId(): number {
  if (!currentSession) throw new NotAuthenticatedError()
  checkIdleAndMaybeLock()
  if (currentSession.locked) throw new SessionLockedError()
  currentSession.lastActivityAt = Date.now()
  return currentSession.userId
}

export function requireRole(roles: UserRole[]): void {
  if (!currentSession) throw new NotAuthenticatedError()
  checkIdleAndMaybeLock()
  if (currentSession.locked) throw new SessionLockedError()
  if (!roles.includes(currentSession.role)) {
    throw new ForbiddenError(currentSession.role, roles)
  }
  currentSession.lastActivityAt = Date.now()
}
