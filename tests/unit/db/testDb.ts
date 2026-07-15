import { createDatabase, type DbConnection } from '../../../src/main/db/client'
import { runMigrations } from '../../../src/main/db/migrator'
import { seedDefaultAdmin, seedDefaultTaxRate, getSeededAdminUserId } from '../../../src/main/db/seed'

export async function createTestDb(): Promise<DbConnection & { adminId: number }> {
  const connection = createDatabase(':memory:')
  await runMigrations(connection.db)
  await seedDefaultAdmin(connection.db)
  await seedDefaultTaxRate(connection.db)
  const adminId = await getSeededAdminUserId(connection.db)
  return { ...connection, adminId }
}
