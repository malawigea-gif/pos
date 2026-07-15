import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/testDb'
import { createUser, InvalidCredentialsError } from '../../../src/main/db/repositories/usersRepository'
import {
  ForbiddenError,
  NotAuthenticatedError,
  SessionLockedError,
  getCurrentUserId,
  getIdleTimeoutMinutes,
  getSession,
  lock,
  login,
  logout,
  requireRole,
  setIdleTimeoutMinutes,
  touchActivity,
  unlock
} from '../../../src/main/auth/session'

// `currentSession` is a module-level singleton (by design — this is a
// single-till desktop app, not a multi-session server), so every test must
// leave it clean for the next one.
afterEach(() => {
  logout()
  setIdleTimeoutMinutes(15)
  vi.useRealTimers()
})

describe('session: login/logout', () => {
  it('login succeeds with correct credentials and populates the session', async () => {
    const { db } = await createTestDb()
    const session = await login(db, 'admin', 'admin123')

    expect(session.username).toBe('admin')
    expect(session.role).toBe('admin')
    expect(session.locked).toBe(false)
    expect(getSession()).not.toBeNull()
    expect(getCurrentUserId()).toBe(session.userId)

    await db.destroy()
  })

  it('login fails with wrong credentials and leaves no session behind', async () => {
    const { db } = await createTestDb()
    await expect(login(db, 'admin', 'wrongpassword')).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(getSession()).toBeNull()

    await db.destroy()
  })

  it('logout clears the session so getCurrentUserId throws NotAuthenticatedError', async () => {
    const { db } = await createTestDb()
    await login(db, 'admin', 'admin123')
    logout()

    expect(getSession()).toBeNull()
    expect(() => getCurrentUserId()).toThrow(NotAuthenticatedError)

    await db.destroy()
  })

  it('getCurrentUserId throws NotAuthenticatedError with no session at all', () => {
    expect(() => getCurrentUserId()).toThrow(NotAuthenticatedError)
  })
})

describe('session: lock/unlock', () => {
  it('lock() blocks getCurrentUserId with SessionLockedError until a correct unlock', async () => {
    const { db } = await createTestDb()
    await login(db, 'admin', 'admin123')

    lock()
    expect(getSession()?.locked).toBe(true)
    expect(() => getCurrentUserId()).toThrow(SessionLockedError)

    await unlock(db, 'admin123')
    expect(getSession()?.locked).toBe(false)
    expect(() => getCurrentUserId()).not.toThrow()

    await db.destroy()
  })

  it('unlock with the wrong password fails and leaves the session locked', async () => {
    const { db } = await createTestDb()
    await login(db, 'admin', 'admin123')
    lock()

    await expect(unlock(db, 'wrongpassword')).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(getSession()?.locked).toBe(true)

    await db.destroy()
  })

  it('unlock with no active session throws NotAuthenticatedError', async () => {
    const { db } = await createTestDb()
    await expect(unlock(db, 'admin123')).rejects.toBeInstanceOf(NotAuthenticatedError)
    await db.destroy()
  })
})

describe('session: idle auto-lock', () => {
  it('locks automatically once the idle timeout elapses, and touchActivity resets the clock', async () => {
    const { db } = await createTestDb()
    vi.useFakeTimers()
    setIdleTimeoutMinutes(5)

    await login(db, 'admin', 'admin123')

    vi.advanceTimersByTime(4 * 60_000)
    touchActivity()
    vi.advanceTimersByTime(4 * 60_000)
    expect(() => getCurrentUserId()).not.toThrow()

    vi.advanceTimersByTime(6 * 60_000)
    expect(() => getCurrentUserId()).toThrow(SessionLockedError)
    expect(getSession()?.locked).toBe(true)

    await db.destroy()
  })

  it('getIdleTimeoutMinutes reflects the most recent setIdleTimeoutMinutes call', () => {
    setIdleTimeoutMinutes(30)
    expect(getIdleTimeoutMinutes()).toBe(30)
  })
})

describe('requireRole', () => {
  it('allows a role that is in the allowed list', async () => {
    const { db } = await createTestDb()
    await login(db, 'admin', 'admin123')
    expect(() => requireRole(['admin', 'manager'])).not.toThrow()
    await db.destroy()
  })

  it('throws ForbiddenError with the actual role and allowed roles for a mismatched role', async () => {
    const { db, adminId } = await createTestDb()
    await createUser(db, {
      username: 'cashierx',
      password: 'secret123',
      fullName: 'Cashier X',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })
    await login(db, 'cashierx', 'secret123')

    try {
      requireRole(['admin', 'manager'])
      expect.unreachable('requireRole should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError)
      expect((err as InstanceType<typeof ForbiddenError>).role).toBe('cashier')
      expect((err as InstanceType<typeof ForbiddenError>).allowedRoles).toEqual(['admin', 'manager'])
    }

    await db.destroy()
  })

  it('throws NotAuthenticatedError when no one is signed in', () => {
    expect(() => requireRole(['admin'])).toThrow(NotAuthenticatedError)
  })
})
