import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { join } from 'path'
import SqliteDatabase from 'better-sqlite3'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { getDb } from '../db'
import type { BackupFileInfo, BackupSettings, UpdateBackupSettingsRequest } from '../../shared/backup'

// Matches both the current "lankapos-backup-*" filenames and the older
// "lankapos-bookshop-backup-*" ones written before the LankaPOS-bookshop ->
// LankaPOS rename, so backups made by older installs still show up and
// remain restorable.
const BACKUP_FILENAME_PATTERN = /^lankapos(?:-bookshop)?-backup-\d{8}-\d{6}\.db$/

const SETTING_KEYS = {
  folder: 'backup.folder',
  autoEnabled: 'backup.autoEnabled',
  intervalHours: 'backup.intervalHours',
  retentionCount: 'backup.retentionCount',
  lastBackupAt: 'backup.lastBackupAt'
} as const

const DEFAULTS = {
  autoEnabled: true,
  intervalHours: 24,
  retentionCount: 14
}

export class InvalidBackupSettingsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBackupSettingsError'
  }
}

export class InvalidBackupFileError extends Error {
  constructor(reason: string) {
    super(`This doesn't look like a valid LankaPOS backup file (${reason}).`)
    this.name = 'InvalidBackupFileError'
  }
}

function buildBackupFileName(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `lankapos-backup-${date}-${time}.db`
}

/** `defaultFolder` is supplied by the caller (derived from Electron's
 *  `app.getPath('userData')`) rather than looked up here, so this module has
 *  no dependency on the Electron runtime and stays plainly unit-testable. */
export async function getBackupSettings(db: Kysely<Database>, defaultFolder: string): Promise<BackupSettings> {
  const [folder, autoEnabled, intervalHours, retentionCount, lastBackupAt] = await Promise.all([
    getSetting(db, SETTING_KEYS.folder),
    getSetting(db, SETTING_KEYS.autoEnabled),
    getSetting(db, SETTING_KEYS.intervalHours),
    getSetting(db, SETTING_KEYS.retentionCount),
    getSetting(db, SETTING_KEYS.lastBackupAt)
  ])

  return {
    folder: folder ?? defaultFolder,
    autoEnabled: autoEnabled !== undefined ? autoEnabled === 'true' : DEFAULTS.autoEnabled,
    intervalHours: intervalHours !== undefined ? Number(intervalHours) : DEFAULTS.intervalHours,
    retentionCount: retentionCount !== undefined ? Number(retentionCount) : DEFAULTS.retentionCount,
    lastBackupAt: lastBackupAt ?? null
  }
}

export async function updateBackupSettings(
  db: Kysely<Database>,
  defaultFolder: string,
  input: UpdateBackupSettingsRequest,
  userId: number | null
): Promise<BackupSettings> {
  if (input.intervalHours !== undefined && input.intervalHours < 1) {
    throw new InvalidBackupSettingsError('The backup interval must be at least 1 hour.')
  }
  if (input.retentionCount !== undefined && input.retentionCount < 1) {
    throw new InvalidBackupSettingsError('At least 1 backup must be kept.')
  }
  if (input.folder !== undefined) {
    try {
      await mkdir(input.folder, { recursive: true })
    } catch {
      throw new InvalidBackupSettingsError('That folder could not be created or accessed.')
    }
  }

  if (input.folder !== undefined) await setSetting(db, SETTING_KEYS.folder, input.folder, userId)
  if (input.autoEnabled !== undefined) {
    await setSetting(db, SETTING_KEYS.autoEnabled, String(input.autoEnabled), userId)
  }
  if (input.intervalHours !== undefined) {
    await setSetting(db, SETTING_KEYS.intervalHours, String(input.intervalHours), userId)
  }
  if (input.retentionCount !== undefined) {
    await setSetting(db, SETTING_KEYS.retentionCount, String(input.retentionCount), userId)
  }

  return getBackupSettings(db, defaultFolder)
}

/** Pure file-level backup: takes a hot, WAL-safe snapshot via better-sqlite3's
 *  own backup() API (safe to call while the live connection stays open). */
export async function createBackupFile(
  liveSqlite: SqliteDatabase.Database,
  folder: string
): Promise<BackupFileInfo> {
  await mkdir(folder, { recursive: true })
  const fileName = buildBackupFileName()
  const filePath = join(folder, fileName)
  await liveSqlite.backup(filePath)
  const stats = await stat(filePath)
  return { fileName, filePath, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() }
}

export async function listBackups(folder: string): Promise<BackupFileInfo[]> {
  let entries: string[]
  try {
    entries = await readdir(folder)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const infos = await Promise.all(
    entries
      .filter((name) => BACKUP_FILENAME_PATTERN.test(name))
      .map(async (name) => {
        const filePath = join(folder, name)
        const stats = await stat(filePath)
        return { fileName: name, filePath, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() }
      })
  )

  return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function pruneBackups(folder: string, retentionCount: number): Promise<void> {
  const backups = await listBackups(folder)
  const excess = backups.slice(retentionCount)
  await Promise.all(excess.map((b) => rm(b.filePath, { force: true })))
}

export async function runBackupNow(
  db: Kysely<Database>,
  defaultFolder: string,
  userId: number | null
): Promise<BackupFileInfo> {
  const settings = await getBackupSettings(db, defaultFolder)
  const { sqlite } = getDb()
  const info = await createBackupFile(sqlite, settings.folder)
  await pruneBackups(settings.folder, settings.retentionCount)
  await setSetting(db, SETTING_KEYS.lastBackupAt, info.createdAt, userId)
  return info
}

/** Called periodically from the main process — a no-op unless auto-backup
 *  is enabled and the configured interval has actually elapsed, so it's
 *  safe to call this often (e.g. every 15 minutes) without over-backing-up. */
export async function runScheduledBackupIfDue(db: Kysely<Database>, defaultFolder: string): Promise<void> {
  const settings = await getBackupSettings(db, defaultFolder)
  if (!settings.autoEnabled) return

  const dueAt = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).getTime() + settings.intervalHours * 60 * 60 * 1000
    : 0
  if (Date.now() < dueAt) return

  await runBackupNow(db, defaultFolder, null)
}

export async function validateBackupFile(filePath: string): Promise<void> {
  // SQLite only validates the file format lazily, on first page access —
  // opening a garbage file successfully constructs a Database handle, and
  // the format error only surfaces once pragma/prepare touch it. So every
  // failure here (constructor, pragma, or the table check) is treated the
  // same way and wrapped as an InvalidBackupFileError.
  let testDb: SqliteDatabase.Database | undefined
  try {
    testDb = new SqliteDatabase(filePath, { readonly: true, fileMustExist: true })

    const integrity = testDb.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new InvalidBackupFileError('failed an integrity check')

    const hasUsersTable = testDb
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get()
    if (!hasUsersTable) throw new InvalidBackupFileError('missing expected tables')
  } catch (err) {
    if (err instanceof InvalidBackupFileError) throw err
    throw new InvalidBackupFileError('not a valid SQLite database file')
  } finally {
    testDb?.close()
  }
}

/** Closes the live connection, overwrites the app's database file with the
 *  chosen backup, and clears any stale WAL/SHM sidecar files left behind by
 *  the old file. The caller (the IPC handler) is responsible for relaunching
 *  the app afterwards — this function deliberately has no Electron
 *  app-lifecycle side effects, so it stays unit-testable on its own. */
export async function restoreDatabaseFile(
  liveSqlite: SqliteDatabase.Database,
  dbPath: string,
  backupFilePath: string
): Promise<void> {
  await validateBackupFile(backupFilePath)
  liveSqlite.close()
  await copyFile(backupFilePath, dbPath)
  await rm(`${dbPath}-wal`, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
}
