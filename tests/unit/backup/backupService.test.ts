import { access, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { createDatabase } from '../../../src/main/db/client'
import {
  createBackupFile,
  getBackupSettings,
  InvalidBackupFileError,
  InvalidBackupSettingsError,
  listBackups,
  pruneBackups,
  restoreDatabaseFile,
  updateBackupSettings,
  validateBackupFile
} from '../../../src/main/backup/backupService'

let tempDir: string
let defaultFolder: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'lankapos-backup-test-'))
  defaultFolder = join(tempDir, 'default-backups')
})

// Windows can hold a brief OS-level lock on a just-closed sqlite file (WAL
// mode's -wal/-shm sidecars in particular), so cleanup retries a few times
// instead of failing the test run on an EBUSY that clears within milliseconds.
afterEach(async () => {
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(tempDir, { recursive: true, force: true })
      return
    } catch (err) {
      if (attempt >= 5) throw err
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
})

describe('backupService: settings', () => {
  it('returns sensible defaults on a fresh database', async () => {
    const { db } = await createTestDb()
    const settings = await getBackupSettings(db, defaultFolder)

    expect(settings.autoEnabled).toBe(true)
    expect(settings.intervalHours).toBe(24)
    expect(settings.retentionCount).toBe(14)
    expect(settings.lastBackupAt).toBeNull()
    expect(settings.folder).toBe(defaultFolder)

    await db.destroy()
  })

  it('persists updates and getBackupSettings reflects them afterwards', async () => {
    const { db, adminId } = await createTestDb()
    const folder = join(tempDir, 'my-backups')

    const updated = await updateBackupSettings(
      db,
      defaultFolder,
      { folder, autoEnabled: false, intervalHours: 6, retentionCount: 5 },
      adminId
    )
    expect(updated.folder).toBe(folder)
    expect(updated.autoEnabled).toBe(false)
    expect(updated.intervalHours).toBe(6)
    expect(updated.retentionCount).toBe(5)

    const reloaded = await getBackupSettings(db, defaultFolder)
    expect(reloaded).toEqual(updated)

    await access(folder)

    await db.destroy()
  })

  it('rejects an interval below 1 hour', async () => {
    const { db, adminId } = await createTestDb()
    await expect(
      updateBackupSettings(db, defaultFolder, { intervalHours: 0 }, adminId)
    ).rejects.toBeInstanceOf(InvalidBackupSettingsError)
    await db.destroy()
  })

  it('rejects a retention count below 1', async () => {
    const { db, adminId } = await createTestDb()
    await expect(
      updateBackupSettings(db, defaultFolder, { retentionCount: 0 }, adminId)
    ).rejects.toBeInstanceOf(InvalidBackupSettingsError)
    await db.destroy()
  })
})

describe('backupService: createBackupFile / listBackups / pruneBackups', () => {
  it('creates a real, listable backup file from a live connection', async () => {
    const { sqlite } = createDatabase(join(tempDir, 'source.db'))
    sqlite.exec('CREATE TABLE marker (id INTEGER)')

    const info = await createBackupFile(sqlite, tempDir)
    expect(info.sizeBytes).toBeGreaterThan(0)

    const listed = await listBackups(tempDir)
    expect(listed).toHaveLength(1)
    expect(listed[0].fileName).toBe(info.fileName)

    // Kysely's `db` was never queried, so its driver never opened a
    // connection to close — the raw better-sqlite3 handle used above is
    // the one actually holding the file open, so close that instead.
    sqlite.close()
  })

  it('returns an empty list for a folder that does not exist yet', async () => {
    const result = await listBackups(join(tempDir, 'does-not-exist'))
    expect(result).toEqual([])
  })

  it('still lists backups written under the pre-rename "lankapos-bookshop-backup-*" filename', async () => {
    const legacyName = 'lankapos-bookshop-backup-20260101-120000.db'
    await writeFile(join(tempDir, legacyName), 'not a real database, just needs to exist for listing')

    const listed = await listBackups(tempDir)
    expect(listed.map((b) => b.fileName)).toEqual([legacyName])
  })

  it('prunes down to the retention count, keeping the newest files', async () => {
    const { sqlite } = createDatabase(join(tempDir, 'source.db'))

    const infos = []
    for (let i = 0; i < 4; i++) {
      // Distinct filenames are timestamp-based (second resolution), so a
      // tiny delay keeps each backup's filename unique in this fast loop.
      await new Promise((resolve) => setTimeout(resolve, 1100))
      infos.push(await createBackupFile(sqlite, tempDir))
    }

    await pruneBackups(tempDir, 2)
    const remaining = await listBackups(tempDir)
    expect(remaining).toHaveLength(2)
    expect(remaining.map((b) => b.fileName)).toEqual([infos[3].fileName, infos[2].fileName])

    sqlite.close()
  }, 15000)
})

describe('backupService: validateBackupFile', () => {
  it('accepts a valid SQLite file that has a users table', async () => {
    const filePath = join(tempDir, 'valid-backup.db')
    const testDb = new SqliteDatabase(filePath)
    testDb.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)')
    testDb.close()

    await expect(validateBackupFile(filePath)).resolves.toBeUndefined()
  })

  it('rejects a file that is not a SQLite database', async () => {
    const filePath = join(tempDir, 'not-a-database.db')
    await writeFile(filePath, 'this is just a text file, not a database')

    await expect(validateBackupFile(filePath)).rejects.toBeInstanceOf(InvalidBackupFileError)
  })

  it('rejects a valid SQLite file that is missing the users table', async () => {
    const filePath = join(tempDir, 'wrong-schema.db')
    const testDb = new SqliteDatabase(filePath)
    testDb.exec('CREATE TABLE something_else (id INTEGER)')
    testDb.close()

    await expect(validateBackupFile(filePath)).rejects.toBeInstanceOf(InvalidBackupFileError)
  })

  it('rejects a path that does not exist', async () => {
    await expect(validateBackupFile(join(tempDir, 'nope.db'))).rejects.toBeInstanceOf(InvalidBackupFileError)
  })
})

describe('backupService: restoreDatabaseFile', () => {
  it('closes the live connection and overwrites it with the backup, clearing stale WAL/SHM files', async () => {
    const livePath = join(tempDir, 'live.db')
    const { sqlite: liveSqlite } = createDatabase(livePath)
    liveSqlite.exec('CREATE TABLE live_marker (id INTEGER)')
    liveSqlite.exec('INSERT INTO live_marker (id) VALUES (1)')

    const backupPath = join(tempDir, 'backup.db')
    const backupDb = new SqliteDatabase(backupPath)
    backupDb.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)')
    backupDb.close()

    await restoreDatabaseFile(liveSqlite, livePath, backupPath)

    expect(liveSqlite.open).toBe(false)
    await expect(access(`${livePath}-wal`)).rejects.toThrow()
    await expect(access(`${livePath}-shm`)).rejects.toThrow()

    const reopened = new SqliteDatabase(livePath, { readonly: true })
    const hasUsers = reopened.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()
    const hasOldMarker = reopened
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='live_marker'")
      .get()
    expect(hasUsers).toBeTruthy()
    expect(hasOldMarker).toBeFalsy()
    reopened.close()
  })

  it('rejects and leaves the live connection open if the backup file is invalid', async () => {
    const livePath = join(tempDir, 'live2.db')
    const { sqlite: liveSqlite } = createDatabase(livePath)

    const badBackupPath = join(tempDir, 'bad-backup.db')
    await writeFile(badBackupPath, 'not a real database')

    await expect(restoreDatabaseFile(liveSqlite, livePath, badBackupPath)).rejects.toBeInstanceOf(
      InvalidBackupFileError
    )
    expect(liveSqlite.open).toBe(true)

    liveSqlite.close()
  })
})
