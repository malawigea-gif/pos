import { describe, expect, it } from 'vitest'
import { NO_MIGRATIONS } from 'kysely'
import { createDatabase } from '../../../src/main/db/client'
import { createMigrator, runMigrations } from '../../../src/main/db/migrator'

const EXPECTED_TABLES = [
  'users',
  'settings',
  'categories',
  'tax_rates',
  'suppliers',
  'books',
  'customers',
  'sales',
  'sale_items',
  'sale_payments',
  'purchase_orders',
  'purchase_order_items',
  'goods_received_notes',
  'grn_items',
  'supplier_payments',
  'returns',
  'return_items',
  'stock_movements',
  'stock_takes',
  'stock_take_items',
  'discounts',
  'combo_offers',
  'loyalty_transactions',
  'preorders',
  'audit_log'
]

function tableNames(sqlite: import('better-sqlite3').Database): string[] {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return rows.map((r) => r.name)
}

describe('migrations', () => {
  it('sets WAL mode and enforces foreign keys', () => {
    const { sqlite } = createDatabase(':memory:')
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    sqlite.close()
  })

  it('migrateToLatest creates every expected table', async () => {
    const { sqlite, db } = createDatabase(':memory:')
    await runMigrations(db)

    const names = tableNames(sqlite)
    for (const expected of EXPECTED_TABLES) {
      expect(names).toContain(expected)
    }

    await db.destroy()
  })

  it('rejects rows that violate a check constraint', async () => {
    const { db } = createDatabase(':memory:')
    await runMigrations(db)

    await expect(
      db
        .insertInto('users')
        .values({
          username: 'baduser',
          password_hash: 'x',
          full_name: 'Bad User',
          role: 'owner' as never,
          language: 'en'
        })
        .execute()
    ).rejects.toThrow()

    await db.destroy()
  })

  it('migrating down to NO_MIGRATIONS drops every table it created', async () => {
    const { sqlite, db } = createDatabase(':memory:')
    await runMigrations(db)

    const migrator = createMigrator(db)
    const { error } = await migrator.migrateTo(NO_MIGRATIONS)
    expect(error).toBeUndefined()

    const names = tableNames(sqlite)
    for (const table of EXPECTED_TABLES) {
      expect(names).not.toContain(table)
    }

    await db.destroy()
  })
})
