import type { Kysely } from 'kysely'
import type { Database } from '../types'
import type { BusinessProfile } from '../../../shared/settings'

export async function getSetting(db: Kysely<Database>, key: string): Promise<string | undefined> {
  const row = await db.selectFrom('settings').select('value').where('key', '=', key).executeTakeFirst()
  return row?.value
}

export async function setSetting(
  db: Kysely<Database>,
  key: string,
  value: string,
  userId: number | null
): Promise<void> {
  const existing = await db.selectFrom('settings').select('id').where('key', '=', key).executeTakeFirst()
  if (existing) {
    await db
      .updateTable('settings')
      .set({ value, updated_by: userId, updated_at: new Date().toISOString() })
      .where('id', '=', existing.id)
      .execute()
  } else {
    await db.insertInto('settings').values({ key, value, updated_by: userId }).execute()
  }
}

const PROFILE_KEYS = {
  businessName: 'profile.businessName',
  phone: 'profile.phone',
  email: 'profile.email',
  address: 'profile.address'
} as const

/** `businessName` defaults to a placeholder rather than an empty string so
 *  a receipt never renders with a blank header before the shop sets its
 *  own profile up. */
export async function getBusinessProfile(db: Kysely<Database>): Promise<BusinessProfile> {
  const [businessName, phone, email, address] = await Promise.all([
    getSetting(db, PROFILE_KEYS.businessName),
    getSetting(db, PROFILE_KEYS.phone),
    getSetting(db, PROFILE_KEYS.email),
    getSetting(db, PROFILE_KEYS.address)
  ])

  return {
    businessName: businessName || 'My Shop',
    phone: phone || null,
    email: email || null,
    address: address || null
  }
}

export async function setBusinessProfile(
  db: Kysely<Database>,
  input: BusinessProfile,
  userId: number | null
): Promise<BusinessProfile> {
  await setSetting(db, PROFILE_KEYS.businessName, input.businessName, userId)
  await setSetting(db, PROFILE_KEYS.phone, input.phone ?? '', userId)
  await setSetting(db, PROFILE_KEYS.email, input.email ?? '', userId)
  await setSetting(db, PROFILE_KEYS.address, input.address ?? '', userId)
  return getBusinessProfile(db)
}
