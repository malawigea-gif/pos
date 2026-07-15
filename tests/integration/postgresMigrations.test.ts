import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '../../src/main/db/migrator'
import type { Database } from '../../src/main/db/types'

// Opt-in only: this hits a real Postgres server, unlike every other test in
// this project (which run against in-memory SQLite). Set TEST_POSTGRES_URL
// to a connection string for a database that's safe to wipe, e.g.
//   TEST_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/lankapos_test
// Skips (not fails) when unset, so `npm test` stays green on a machine with
// no local Postgres — but that means this suite has NOT been run as part of
// verifying Task 2 until someone sets the env var and runs it for real.
const connectionString = process.env.TEST_POSTGRES_URL

if (!connectionString) {
  console.warn(
    '[test] Skipping tests/integration/postgresMigrations.test.ts — set TEST_POSTGRES_URL to run the ' +
      'migration chain against a real Postgres server (e.g. postgres://postgres:postgres@localhost:5432/lankapos_test).'
  )
}

describe.skipIf(!connectionString)('Postgres migration compatibility', () => {
  let pool: Pool
  let db: Kysely<Database>

  beforeAll(async () => {
    pool = new Pool({ connectionString })
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
    // Start from a clean slate so this is repeatable against a reused server,
    // rather than requiring a freshly-created database every run.
    await sql`DROP SCHEMA public CASCADE`.execute(db)
    await sql`CREATE SCHEMA public`.execute(db)
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('runs the full 14-migration chain against a fresh Postgres database without error', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined()
  })

  it('produces the same 28 tables as the SQLite path', async () => {
    const { rows } = await sql<{ table_name: string }>`
      select table_name from information_schema.tables where table_schema = 'public'
    `.execute(db)
    const tableNames = rows.map((r) => r.table_name).sort()
    expect(tableNames).toHaveLength(28)
    expect(tableNames).toEqual(
      [
        'audit_log',
        'books',
        'categories',
        'combo_offers',
        'customers',
        'discounts',
        'goods_received_notes',
        'grn_items',
        'loyalty_transactions',
        'preorders',
        'purchase_order_items',
        'purchase_orders',
        'quotation_items',
        'quotations',
        'register_closings',
        'return_items',
        'returns',
        'sale_items',
        'sale_payments',
        'sales',
        'settings',
        'stock_movements',
        'stock_take_items',
        'stock_takes',
        'supplier_payments',
        'suppliers',
        'tax_rates',
        'users'
      ].sort()
    )
  })

  it('gives auto-incrementing id columns a working sequence default (the AUTOINCREMENT -> serial fix)', async () => {
    const inserted = await db
      .insertInto('categories')
      .values({ name: 'Postgres migration test category' })
      .returning('id')
      .executeTakeFirstOrThrow()
    expect(typeof inserted.id).toBe('number')
    expect(inserted.id).toBeGreaterThan(0)
  })

  it('stores money columns as double precision, matching SQLite REAL\'s 8-byte precision', async () => {
    const { rows } = await sql<{ data_type: string }>`
      select data_type from information_schema.columns
      where table_name = 'books' and column_name = 'cost_price'
    `.execute(db)
    expect(rows[0]?.data_type).toBe('double precision')
  })

  it('gives text timestamp columns a working, syntactically valid default (the CURRENT_TIMESTAMP cast fix)', async () => {
    const inserted = await db
      .insertInto('categories')
      .values({ name: 'Postgres migration test category 2' })
      .returning(['created_at'])
      .executeTakeFirstOrThrow()
    // Same YYYY-MM-DDTHH:MM:SS.sssZ shape every repository writes via
    // `new Date().toISOString()` on explicit insert.
    expect(inserted.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
