import { describe, expect, it } from 'vitest'
import { createTestDb } from './testDb'
import {
  changePassword,
  createUser,
  getUserById,
  InvalidCredentialsError,
  listUsers,
  setUserActive,
  UsernameTakenError,
  UserInactiveError,
  updateUser,
  verifyCredentials
} from '../../../src/main/db/repositories/usersRepository'

describe('usersRepository', () => {
  it('creates a user with a bcrypt-hashed password that never comes back in reads', async () => {
    const { db, adminId } = await createTestDb()
    const user = await createUser(db, {
      username: 'cashier1',
      password: 'secret123',
      fullName: 'Nimal Perera',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })

    expect(user).not.toHaveProperty('password_hash')
    expect(user.username).toBe('cashier1')
    expect(user.is_active).toBe(1)

    const stored = await db
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow()
    expect(stored.password_hash).not.toBe('secret123')

    await db.destroy()
  })

  it('rejects creating a user with a username that is already taken', async () => {
    const { db, adminId } = await createTestDb()
    await createUser(db, {
      username: 'manager1',
      password: 'pw12345',
      fullName: 'Kamal Silva',
      role: 'manager',
      language: 'en',
      userId: adminId
    })

    await expect(
      createUser(db, {
        username: 'manager1',
        password: 'different',
        fullName: 'Someone Else',
        role: 'cashier',
        language: 'en',
        userId: adminId
      })
    ).rejects.toBeInstanceOf(UsernameTakenError)

    await db.destroy()
  })

  it('updates full name, role, and language without touching the password', async () => {
    const { db, adminId } = await createTestDb()
    const user = await createUser(db, {
      username: 'cashier2',
      password: 'secret123',
      fullName: 'Old Name',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })

    const updated = await updateUser(db, user.id, {
      fullName: 'New Name',
      role: 'manager',
      language: 'si',
      userId: adminId
    })

    expect(updated.full_name).toBe('New Name')
    expect(updated.role).toBe('manager')
    expect(updated.language).toBe('si')

    await db.destroy()
  })

  it('setUserActive toggles is_active and getUserById/listUsers reflect it', async () => {
    const { db, adminId } = await createTestDb()
    const user = await createUser(db, {
      username: 'cashier3',
      password: 'secret123',
      fullName: 'Sunil Fernando',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })

    await setUserActive(db, user.id, false, adminId)
    const fetched = await getUserById(db, user.id)
    expect(fetched?.is_active).toBe(0)

    const all = await listUsers(db)
    expect(all.find((u) => u.id === user.id)?.is_active).toBe(0)

    await db.destroy()
  })

  it('changePassword updates the hash so the new password verifies and the old one no longer does', async () => {
    const { db, adminId } = await createTestDb()
    const user = await createUser(db, {
      username: 'cashier4',
      password: 'oldpassword',
      fullName: 'Ruwan Jayasuriya',
      role: 'cashier',
      language: 'en',
      userId: adminId
    })

    await changePassword(db, user.id, 'newpassword', adminId)

    await expect(verifyCredentials(db, 'cashier4', 'oldpassword')).rejects.toBeInstanceOf(
      InvalidCredentialsError
    )
    const verified = await verifyCredentials(db, 'cashier4', 'newpassword')
    expect(verified.id).toBe(user.id)

    await db.destroy()
  })

  describe('verifyCredentials', () => {
    it('succeeds for the seeded admin with the correct password', async () => {
      const { db } = await createTestDb()
      const user = await verifyCredentials(db, 'admin', 'admin123')
      expect(user.username).toBe('admin')
      expect(user.role).toBe('admin')
      await db.destroy()
    })

    it('throws InvalidCredentialsError for a wrong password', async () => {
      const { db } = await createTestDb()
      await expect(verifyCredentials(db, 'admin', 'wrongpassword')).rejects.toBeInstanceOf(
        InvalidCredentialsError
      )
      await db.destroy()
    })

    it('throws the same InvalidCredentialsError for a non-existent username (no user enumeration)', async () => {
      const { db } = await createTestDb()
      await expect(verifyCredentials(db, 'nosuchuser', 'whatever')).rejects.toBeInstanceOf(
        InvalidCredentialsError
      )
      await db.destroy()
    })

    it('throws UserInactiveError for a deactivated user with the correct password', async () => {
      const { db, adminId } = await createTestDb()
      const user = await createUser(db, {
        username: 'inactiveuser',
        password: 'secret123',
        fullName: 'Deactivated Person',
        role: 'cashier',
        language: 'en',
        userId: adminId
      })
      await setUserActive(db, user.id, false, adminId)

      await expect(verifyCredentials(db, 'inactiveuser', 'secret123')).rejects.toBeInstanceOf(
        UserInactiveError
      )

      await db.destroy()
    })
  })
})
