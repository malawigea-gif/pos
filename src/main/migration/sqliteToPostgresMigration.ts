import SqliteDatabase from 'better-sqlite3'
import { Kysely, SqliteDialect, sql } from 'kysely'
import type { Database } from '../db/types'
import type { DestinationTableCounts, MigrationRowCounts } from '../../shared/migration'

/** Same order as the migrations that create these tables (migrator.ts) —
 *  already a valid FK-dependency order (a migration can only reference a
 *  table created by an earlier one), so importing in this order never
 *  violates a foreign key. */
const TABLE_ORDER: (keyof Database)[] = [
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
  'audit_log',
  'register_closings',
  'quotations',
  'quotation_items'
]

// seedDefaultAdmin()/seedDefaultTaxRate() (db/seed.ts) populate these two
// tables on every initDatabase() call, including a fresh Postgres server's
// very first Networked-mode connection — so a "freshly migrated, otherwise
// empty" destination still has one admin user and one tax rate row before
// this tool ever runs. Those seed rows are cleared (not counted as
// "already has data") so the source's own users/tax_rates rows can be
// imported with their original ids intact.
const SEEDED_TABLES: (keyof Database)[] = ['tax_rates', 'users']

const BATCH_SIZE = 500

export class DestinationNotEmptyError extends Error {
  constructor(public readonly tableCounts: DestinationTableCounts) {
    super('The destination server already has data — refusing to import to avoid duplicating rows.')
    this.name = 'DestinationNotEmptyError'
  }
}

export class MigrationRequiresNetworkedModeError extends Error {
  constructor() {
    super('This till must already be running in Networked mode before importing data into the shared server.')
    this.name = 'MigrationRequiresNetworkedModeError'
  }
}

async function countExistingRows(dest: Kysely<Database>): Promise<DestinationTableCounts> {
  const counts: DestinationTableCounts = {}
  for (const table of TABLE_ORDER) {
    if (SEEDED_TABLES.includes(table)) continue
    const row = await dest
      .selectFrom(table)
      .select(sql<number>`count(*)`.as('count'))
      .executeTakeFirstOrThrow()
    counts[table] = Number(row.count)
  }
  return counts
}

async function copyTable(source: Kysely<Database>, dest: Kysely<Database>, table: keyof Database): Promise<number> {
  const rows = await source.selectFrom(table).selectAll().execute()
  if (rows.length === 0) return 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    // Postgres has a hard 65535-parameter-per-query limit — batching keeps
    // even the widest table (books, ~16 columns) and largest realistic
    // shop history well clear of it, regardless of row count.
    const batch = rows.slice(i, i + BATCH_SIZE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dest.insertInto(table).values(batch as any).execute()
  }

  // Every imported row keeps its original id (that's the whole point —
  // "preserving IDs/relationships/timestamps exactly"), so the
  // destination's auto-increment sequence has to be advanced past the
  // highest one, or the next row created through normal app use afterwards
  // would collide with an imported id. SQLite has no equivalent step (no
  // separate sequence object — its rowid-alias tracking is per-row).
  await sql`
    select setval(
      pg_get_serial_sequence(${table}, 'id'),
      coalesce((select max(id) from ${sql.table(table)}), 1),
      (select max(id) from ${sql.table(table)}) is not null
    )
  `.execute(dest)

  return rows.length
}

/** One-time import for a shop moving from Standalone to Networked mode.
 *  `destDb` is the app's own currently-connected Kysely instance — this
 *  only makes sense to call once this till is already running in
 *  Networked mode (checked by the caller, ipc/migration.ts), so `destDb`
 *  is guaranteed to be the Postgres connection. Refuses outright if the
 *  destination has any real data already (see SEEDED_TABLES for the one
 *  exception), and runs as a single transaction — either the whole import
 *  lands, or none of it does. */
export async function migrateSqliteToPostgres(
  sourceSqlitePath: string,
  destDb: Kysely<Database>
): Promise<MigrationRowCounts> {
  const sourceSqlite = new SqliteDatabase(sourceSqlitePath, { readonly: true, fileMustExist: true })
  const sourceDb = new Kysely<Database>({ dialect: new SqliteDialect({ database: sourceSqlite }) })

  try {
    return await destDb.transaction().execute(async (trx) => {
      const existing = await countExistingRows(trx)
      const nonEmpty = Object.values(existing).some((count) => count > 0)
      if (nonEmpty) throw new DestinationNotEmptyError(existing)

      for (const table of SEEDED_TABLES) {
        await trx.deleteFrom(table).execute()
      }

      const counts: MigrationRowCounts = {}
      for (const table of TABLE_ORDER) {
        counts[table] = await copyTable(sourceDb, trx, table)
      }
      return counts
    })
  } finally {
    await sourceDb.destroy()
    sourceSqlite.close()
  }
}
