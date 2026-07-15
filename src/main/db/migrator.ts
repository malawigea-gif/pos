import { Migrator, type Kysely, type Migration, type MigrationProvider } from 'kysely'
import * as m0001 from './migrations/0001_users_and_settings'
import * as m0002 from './migrations/0002_catalog'
import * as m0003 from './migrations/0003_customers'
import * as m0004 from './migrations/0004_sales'
import * as m0005 from './migrations/0005_purchasing'
import * as m0006 from './migrations/0006_returns'
import * as m0007 from './migrations/0007_stock'
import * as m0008 from './migrations/0008_discounts'
import * as m0009 from './migrations/0009_loyalty_and_preorders'
import * as m0010 from './migrations/0010_audit_log'
import * as m0011 from './migrations/0011_categories_default_reorder_level'
import * as m0012 from './migrations/0012_register_closings'
import * as m0013 from './migrations/0013_add_brand_to_books'
import * as m0014 from './migrations/0014_quotations'

// Migrations are statically imported (rather than read from disk with
// Kysely's FileMigrationProvider) because this runs from a Rollup-bundled
// Electron main process, where dynamic fs-based discovery of sibling files
// doesn't survive bundling/packaging.
const migrations: Record<string, Migration> = {
  '0001_users_and_settings': m0001,
  '0002_catalog': m0002,
  '0003_customers': m0003,
  '0004_sales': m0004,
  '0005_purchasing': m0005,
  '0006_returns': m0006,
  '0007_stock': m0007,
  '0008_discounts': m0008,
  '0009_loyalty_and_preorders': m0009,
  '0010_audit_log': m0010,
  '0011_categories_default_reorder_level': m0011,
  '0012_register_closings': m0012,
  '0013_add_brand_to_books': m0013,
  '0014_quotations': m0014
}

const staticMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  }
}

export function createMigrator<DB>(db: Kysely<DB>): Migrator {
  return new Migrator({ db: db as unknown as Kysely<unknown>, provider: staticMigrationProvider })
}

export async function runMigrations<DB>(db: Kysely<DB>): Promise<void> {
  const migrator = createMigrator(db)
  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`[db] migration "${result.migrationName}" applied`)
    } else if (result.status === 'Error') {
      console.error(`[db] migration "${result.migrationName}" failed`)
    }
  }

  if (error) {
    throw error
  }
}
