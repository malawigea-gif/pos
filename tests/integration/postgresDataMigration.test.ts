import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../src/main/db/migrator'
import { createDatabase } from '../../src/main/db/client'
import { seedDefaultAdmin, seedDefaultTaxRate, getSeededAdminUserId } from '../../src/main/db/seed'
import { createCategory } from '../../src/main/db/repositories/categoriesRepository'
import { createBook } from '../../src/main/db/repositories/booksRepository'
import { createCustomer } from '../../src/main/db/repositories/customersRepository'
import {
  DestinationNotEmptyError,
  migrateSqliteToPostgres
} from '../../src/main/migration/sqliteToPostgresMigration'
import { createIsolatedTestDatabase } from './pgTestDatabase'
import type { Database } from '../../src/main/db/types'

const TEST_DB_NAME = 'lankapos_test_data_migration'

// Opt-in only, same convention as the other tests/integration/*.test.ts
// files — set TEST_POSTGRES_URL to run this against a real server. This
// one specifically cannot be approximated against SQLite at all (unlike
// postgresConcurrency.test.ts, which at least tests real concurrent
// connections): migrateSqliteToPostgres() resets each table's sequence via
// pg_get_serial_sequence(), a Postgres-only function that doesn't exist in
// SQLite, so a SQLite destination would fail outright, not just fail to
// prove the race.
const connectionString = process.env.TEST_POSTGRES_URL

if (!connectionString) {
  console.warn(
    '[test] Skipping tests/integration/postgresDataMigration.test.ts — set TEST_POSTGRES_URL to prove the ' +
      'Task 7 SQLite -> Postgres import (row counts, id preservation, sequence reset, and the ' +
      'already-has-data refusal) actually works against a real server.'
  )
}

describe.skipIf(!connectionString)('SQLite -> Postgres data migration', () => {
  let pool: Pool
  let destDb: Kysely<Database>
  let tempDir: string
  let sourcePath: string

  // See postgresConcurrency.test.ts's beforeAll comment for why this needs
  // a longer-than-default hook timeout — this one recreates a whole
  // database per test (beforeEach, not beforeAll), so it pays that cost
  // more often than the other two files.
  beforeEach(async () => {
    // Fresh destination database for every test, so "already has data" from
    // one test can't leak into the next.
    pool = await createIsolatedTestDatabase(connectionString!, TEST_DB_NAME)
    destDb = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
    await runMigrations(destDb)
    await seedDefaultAdmin(destDb)
    await seedDefaultTaxRate(destDb)

    tempDir = await mkdtemp(join(tmpdir(), 'lankapos-migration-test-'))
    sourcePath = join(tempDir, 'source.db')
  }, 30000)

  afterEach(async () => {
    await destDb.destroy()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('copies rows with original ids preserved, and leaves working sequences behind', async () => {
    // Build a small but real source: category -> book, plus a customer,
    // exercising two of the FK relationships the import has to respect.
    const { sqlite, db: sourceDb } = createDatabase(sourcePath)
    await runMigrations(sourceDb)
    await seedDefaultAdmin(sourceDb)
    await seedDefaultTaxRate(sourceDb)
    const sourceAdminId = await getSeededAdminUserId(sourceDb)

    const category = await createCategory(sourceDb, { name: 'Textbooks', userId: sourceAdminId })
    const book = await createBook(sourceDb, {
      title: 'Migration Test Book',
      categoryId: category.id,
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 3,
      userId: sourceAdminId
    })
    await createCustomer(sourceDb, { name: 'Migration Test Customer', userId: sourceAdminId })
    sqlite.close()

    const counts = await migrateSqliteToPostgres(sourcePath, destDb)

    expect(counts.categories).toBe(1)
    expect(counts.books).toBe(1)
    expect(counts.customers).toBe(1)
    expect(counts.users).toBe(1) // the source's own seeded admin, not destDb's

    const importedBook = await destDb
      .selectFrom('books')
      .selectAll()
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    expect(importedBook.title).toBe('Migration Test Book')
    expect(importedBook.category_id).toBe(category.id)

    // The sequence has to be advanced past the imported id, or the very
    // next book created through normal app use would collide with it.
    const nextCategory = await createCategory(destDb, { name: 'Post-migration category', userId: null })
    expect(nextCategory.id).toBeGreaterThan(category.id)
  })

  it('refuses to import into a server that already has real data', async () => {
    const { sqlite, db: sourceDb } = createDatabase(sourcePath)
    await runMigrations(sourceDb)
    sqlite.close()

    // Give the destination some real (non-seed) data first.
    await createCategory(destDb, { name: 'Already here', userId: null })

    await expect(migrateSqliteToPostgres(sourcePath, destDb)).rejects.toBeInstanceOf(DestinationNotEmptyError)
  })
})
