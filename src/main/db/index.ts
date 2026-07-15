import { app } from 'electron'
import { join } from 'path'
import { access, copyFile, cp, mkdir } from 'fs/promises'
import { createDatabase, type DbConnection } from './client'
import { runMigrations } from './migrator'
import { seedDefaultAdmin, seedDefaultTaxRate } from './seed'

const DB_FILENAME = 'lankapos-bookshop.db'
const LEGACY_USERDATA_FOLDER_NAME = 'LankaPOS-bookshop'

let connection: DbConnection | undefined
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

export async function initDatabase(): Promise<DbConnection> {
  const newUserDataDir = app.getPath('userData')
  const oldUserDataDir = join(app.getPath('appData'), LEGACY_USERDATA_FOLDER_NAME)
  await migrateLegacyUserData(oldUserDataDir, newUserDataDir)

  dbFilePath = join(newUserDataDir, DB_FILENAME)
  connection = createDatabase(dbFilePath)
  await runMigrations(connection.db)
  await seedDefaultAdmin(connection.db)
  await seedDefaultTaxRate(connection.db)
  return connection
}

export function getDb(): DbConnection {
  if (!connection) {
    throw new Error('Database has not been initialized yet. Call initDatabase() first.')
  }
  return connection
}

export function getDbPath(): string {
  if (!dbFilePath) {
    throw new Error('Database has not been initialized yet. Call initDatabase() first.')
  }
  return dbFilePath
}
