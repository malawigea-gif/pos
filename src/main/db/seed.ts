import bcrypt from 'bcryptjs'
import type { Kysely } from 'kysely'
import type { Database } from './types'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin123'

export async function seedDefaultAdmin(db: Kysely<Database>): Promise<void> {
  const existing = await db.selectFrom('users').select('id').executeTakeFirst()
  if (existing) return

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)
  await db
    .insertInto('users')
    .values({
      username: DEFAULT_ADMIN_USERNAME,
      password_hash: passwordHash,
      full_name: 'Administrator',
      role: 'admin',
      language: 'si',
      is_active: 1
    })
    .execute()
}

/** Books are VAT-exempt under current Sri Lankan tax law, but that's a
 *  policy fact that changes, not something to hard-code — so a fresh
 *  install gets one configurable, editable "no tax" default rate rather
 *  than leaving every book's tax_rate_id unset. */
export async function seedDefaultTaxRate(db: Kysely<Database>): Promise<void> {
  const existing = await db.selectFrom('tax_rates').select('id').executeTakeFirst()
  if (existing) return

  await db
    .insertInto('tax_rates')
    .values({
      name: 'Standard (Exempt)',
      rate_percent: 0,
      is_exempt: 1,
      is_default: 1,
      is_active: 1
    })
    .execute()
}

/** Looks up the seeded admin account's id — used by tests that need a real
 *  user id to pass directly into repository functions without going
 *  through a full login session. Production code should use the signed-in
 *  session's user id (src/main/auth/session.ts) instead. */
export async function getSeededAdminUserId(db: Kysely<Database>): Promise<number> {
  const admin = await db
    .selectFrom('users')
    .select('id')
    .where('username', '=', DEFAULT_ADMIN_USERNAME)
    .executeTakeFirstOrThrow()
  return admin.id
}
