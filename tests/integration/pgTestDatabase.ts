import { Pool } from 'pg'

/** Each tests/integration/*.test.ts file gets its own dedicated database
 *  (not just its own schema) so multiple integration files can safely run
 *  in the same vitest invocation without racing each other's resets
 *  against one shared TEST_POSTGRES_URL database — vitest runs test files
 *  in parallel worker processes by default. A dedicated *schema* was tried
 *  first (see git history) but Kysely's Migrator ignores the connection's
 *  search_path for its own kysely_migration/kysely_migration_lock
 *  bookkeeping tables — they land in `public` regardless — so two test
 *  files sharing one database would still collide on those two tables even
 *  with every other table correctly isolated. A dedicated database sidesteps
 *  that entirely, since `public` genuinely is fully isolated per database. */
export async function createIsolatedTestDatabase(connectionString: string, dbName: string): Promise<Pool> {
  const adminUrl = new URL(connectionString)
  adminUrl.pathname = '/postgres' // the maintenance database, always present, never itself dropped

  const bootstrap = new Pool({ connectionString: adminUrl.toString() })
  try {
    // Disconnect anything still attached (e.g. a previous run that didn't
    // clean up) so DROP DATABASE doesn't fail with "database is being accessed".
    await bootstrap.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [
      dbName
    ])
    await bootstrap.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    await bootstrap.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    await bootstrap.end()
  }

  const testUrl = new URL(connectionString)
  testUrl.pathname = `/${dbName}`
  return new Pool({ connectionString: testUrl.toString() })
}
