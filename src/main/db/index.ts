import { app } from 'electron'
import { join } from 'path'
import { access, copyFile, cp, mkdir } from 'fs/promises'
import type SqliteDatabase from 'better-sqlite3'
import { createDatabase, type DbConnection } from './client'
import { createPostgresDatabase, type PgConnection } from './client-postgres'
import { loadAppConfig } from '../config/appConfig'
import { runMigrations } from './migrator'
import { seedDefaultAdmin, seedDefaultTaxRate } from './seed'

const DB_FILENAME = 'lankapos-bookshop.db'
const LEGACY_USERDATA_FOLDER_NAME = 'LankaPOS-bookshop'

/** Either dialect exposes the same `Kysely<Database>` query interface, so
 *  every repository/IPC handler that only needs `.db` stays dialect-blind.
 *  `sqlite`/`pool` are the dialect-specific escape hatches for the handful
 *  of call sites (file-based backup/restore) that genuinely need the raw
 *  handle — see `getStandaloneSqlite()` below. */
export type AppDbConnection =
  | ({ mode: 'standalone' } & DbConnection)
  | ({ mode: 'networked' } & PgConnection)

let connection: AppDbConnection | undefined
let dbFilePath: string | undefined

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * One-time migration for upgraders. Electron's userData folder is derived
 * from the app's productName, so renaming it from "LankaPOS-bookshop" to
 * "LankaPOS" moves that folder from `%APPDATA%\LankaPOS-bookshop\` to
 * `%APPDATA%\LankaPOS\` on next launch. Without this, an existing install's
 * database and backups would still be on disk under the old folder but no
 * longer looked at — silently appearing as "lost" to the user. If the new
 * folder has no database yet and the old folder does, copy the database
 * (plus its WAL/SHM sidecars) and the backups folder across before
 * `initDatabase()` opens anything. The old folder is left in place, not
 * deleted, so nothing is destructive if a copy fails partway.
 *
 * Takes explicit paths rather than calling `app.getPath()` itself so it
 * stays Electron-free and unit-testable, matching `backupService.ts`'s
 * convention.
 */
export async function migrateLegacyUserData(oldUserDataDir: string, newUserDataDir: string): Promise<void> {
  const newDbPath = join(newUserDataDir, DB_FILENAME)
  if (await pathExists(newDbPath)) return

  const oldDbPath = join(oldUserDataDir, DB_FILENAME)
  if (!(await pathExists(oldDbPath))) return

  await mkdir(newUserDataDir, { recursive: true })

  for (const suffix of ['', '-wal', '-shm']) {
    const from = `${oldDbPath}${suffix}`
    if (await pathExists(from)) {
      await copyFile(from, `${newDbPath}${suffix}`)
    }
  }

  const oldBackupsDir = join(oldUserDataDir, 'backups')
  if (await pathExists(oldBackupsDir)) {
    await cp(oldBackupsDir, join(newUserDataDir, 'backups'), { recursive: true })
  }
}

export async function initDatabase(): Promise<AppDbConnection> {
  const newUserDataDir = app.getPath('userData')
  const config = await loadAppConfig(newUserDataDir)

  if (config.mode === 'networked') {
    connection = { mode: 'networked', ...createPostgresDatabase(config.networked) }
    dbFilePath = undefined
  } else {
    const oldUserDataDir = join(app.getPath('appData'), LEGACY_USERDATA_FOLDER_NAME)
    await migrateLegacyUserData(oldUserDataDir, newUserDataDir)

    dbFilePath = join(newUserDataDir, DB_FILENAME)
    connection = { mode: 'standalone', ...createDatabase(dbFilePath) }
  }

  await runMigrations(connection.db)
  await seedDefaultAdmin(connection.db)
  await seedDefaultTaxRate(connection.db)
  return connection
}

export function getDb(): AppDbConnection {
  if (!connection) {
    throw new Error('Database has not been initialized yet. Call initDatabase() first.')
  }
  return connection
}

export function getDbPath(): string {
  if (!dbFilePath) {
    throw new Error('Database has not been initialized yet, or the active connection is Networked mode (no local file path).')
  }
  return dbFilePath
}

/** File-based backup/restore only makes sense against a local SQLite file —
 *  Networked mode's backup story is `pg_dump`/`pg_restore` against the
 *  server instead (see backup/backupService.ts's networked path). Throws
 *  rather than silently no-op-ing so a Networked-mode till can't be led into
 *  thinking a file backup succeeded. */
export function getStandaloneSqlite(): SqliteDatabase.Database {
  const conn = getDb()
  if (conn.mode !== 'standalone') {
    throw new Error(
      'File-based backup/restore is only available in Standalone mode. Networked-mode servers are backed up with pg_dump/pg_restore instead.'
    )
  }
  return conn.sqlite
}
