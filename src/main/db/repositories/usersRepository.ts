import bcrypt from 'bcryptjs'
import type { Kysely } from 'kysely'
import type { AppLanguage, Database, UserRole } from '../types'
import { recordAudit } from '../audit'

const SAFE_COLUMNS = [
  'id',
  'username',
  'full_name',
  'role',
  'language',
  'is_active',
  'created_at',
  'updated_at'
] as const

export class UsernameTakenError extends Error {
  constructor(public readonly username: string) {
    super(`Username "${username}" is already taken`)
    this.name = 'UsernameTakenError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password')
    this.name = 'InvalidCredentialsError'
  }
}

export class UserInactiveError extends Error {
  constructor(public readonly username: string) {
    super(`User "${username}" is deactivated`)
    this.name = 'UserInactiveError'
  }
}

export function listUsers(db: Kysely<Database>) {
  return db.selectFrom('users').select(SAFE_COLUMNS).orderBy('username').execute()
}

export function getUserById(db: Kysely<Database>, id: number) {
  return db.selectFrom('users').select(SAFE_COLUMNS).where('id', '=', id).executeTakeFirst()
}

export interface CreateUserInput {
  username: string
  password: string
  fullName: string
  role: UserRole
  language: AppLanguage
  userId: number | null
}

export async function createUser(db: Kysely<Database>, input: CreateUserInput) {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('users')
      .select('id')
      .where('username', '=', input.username)
      .executeTakeFirst()
    if (existing) throw new UsernameTakenError(input.username)

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await trx
      .insertInto('users')
      .values({
        username: input.username,
        password_hash: passwordHash,
        full_name: input.fullName,
        role: input.role,
        language: input.language,
        is_active: 1
      })
      .returning(SAFE_COLUMNS)
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'create',
      entityType: 'users',
      entityId: user.id,
      after: { username: user.username, role: user.role }
    })

    return user
  })
}

export interface UpdateUserInput {
  fullName?: string
  role?: UserRole
  language?: AppLanguage
  userId: number | null
}

export async function updateUser(db: Kysely<Database>, id: number, input: UpdateUserInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('users')
      .select(SAFE_COLUMNS)
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('users')
      .set({
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.language !== undefined && { language: input.language }),
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returning(SAFE_COLUMNS)
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'users',
      entityId: id,
      before,
      after
    })

    return after
  })
}

export async function setUserActive(
  db: Kysely<Database>,
  id: number,
  isActive: boolean,
  userId: number | null
) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('users')
      .select(SAFE_COLUMNS)
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('users')
      .set({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .returning(SAFE_COLUMNS)
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId,
      action: 'update',
      entityType: 'users',
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: after.is_active }
    })

    return after
  })
}

/** Used both for an admin resetting someone else's password and for a
 *  user changing their own — the audit trail never records the password
 *  itself, only that a change happened and who triggered it. */
export async function changePassword(
  db: Kysely<Database>,
  id: number,
  newPassword: string,
  actingUserId: number | null
): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db
    .updateTable('users')
    .set({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .where('id', '=', id)
    .execute()

  await recordAudit(db, {
    userId: actingUserId,
    action: 'update',
    entityType: 'users',
    entityId: id,
    after: { password_changed: true }
  })
}

export async function verifyCredentials(db: Kysely<Database>, username: string, password: string) {
  const user = await db.selectFrom('users').selectAll().where('username', '=', username).executeTakeFirst()
  // Deliberately the same error for "no such user" and "wrong password" —
  // distinguishing them lets an attacker enumerate valid usernames.
  if (!user) throw new InvalidCredentialsError()

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) throw new InvalidCredentialsError()

  if (!user.is_active) throw new UserInactiveError(username)

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    language: user.language,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at
  }
}
