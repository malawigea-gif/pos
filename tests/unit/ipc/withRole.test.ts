import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { createUser } from '../../../src/main/db/repositories/usersRepository'
import { ForbiddenError, NotAuthenticatedError, login, logout } from '../../../src/main/auth/session'
import { withRole } from '../../../src/main/ipc/errors'

afterEach(() => {
  logout()
})

describe('withRole', () => {
  it('invokes the wrapped function and returns its result when the role is allowed', async () => {
    const { db } = await createTestDb()
    await login(db, 'admin', 'admin123')

    const guarded = withRole(['admin'], (x: number, y: number) => x + y)
    await expect(guarded(2, 3)).resolves.toBe(5)

    await db.destroy()
  })

  it('throws ForbiddenError and never calls the wrapped function for a disallowed role', async () => {
    const { db, adminId } = await createTestDb()
    await createUser(db, {
      username: 'cashiery',
      password: 'secret123',
      fullName: 'Cashier Y',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })
    await login(db, 'cashiery', 'secret123')

    let called = false
    const guarded = withRole(['admin', 'manager'], () => {
      called = true
    })

    await expect(guarded()).rejects.toBeInstanceOf(ForbiddenError)
    expect(called).toBe(false)

    await db.destroy()
  })

  it('throws NotAuthenticatedError when nobody is signed in', async () => {
    const guarded = withRole(['admin'], () => 'unreachable')
    await expect(guarded()).rejects.toBeInstanceOf(NotAuthenticatedError)
  })
})
