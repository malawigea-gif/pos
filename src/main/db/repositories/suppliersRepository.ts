import type { Kysely } from 'kysely'
import type { Database } from '../types'
import { recordAudit } from '../audit'

export interface ListSuppliersOptions {
  search?: string
}

export function listSuppliers(db: Kysely<Database>, options: ListSuppliersOptions = {}) {
  let query = db.selectFrom('suppliers').selectAll()
  if (options.search) {
    const term = `%${options.search}%`
    query = query.where((eb) =>
      eb.or([eb('name', 'like', term), eb('phone', 'like', term), eb('email', 'like', term)])
    )
  }
  return query.orderBy('name').execute()
}

export function getSupplierById(db: Kysely<Database>, id: number) {
  return db.selectFrom('suppliers').selectAll().where('id', '=', id).executeTakeFirst()
}

export interface SupplierFormInput {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface CreateSupplierInput extends SupplierFormInput {
  userId: number | null
}

export async function createSupplier(db: Kysely<Database>, input: CreateSupplierInput) {
  const supplier = await db
    .insertInto('suppliers')
    .values({
      name: input.name,
      contact_person: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      balance: 0
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordAudit(db, {
    userId: input.userId,
    action: 'create',
    entityType: 'suppliers',
    entityId: supplier.id,
    after: { name: supplier.name }
  })

  return supplier
}

export interface UpdateSupplierInput extends SupplierFormInput {
  userId: number | null
}

export async function updateSupplier(db: Kysely<Database>, id: number, input: UpdateSupplierInput) {
  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('suppliers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    const after = await trx
      .updateTable('suppliers')
      .set({
        name: input.name,
        contact_person: input.contactPerson ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await recordAudit(trx, {
      userId: input.userId,
      action: 'update',
      entityType: 'suppliers',
      entityId: id,
      before,
      after
    })

    return after
  })
}
