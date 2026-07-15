import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyUserData } from '../../../src/main/db'

let tempDir: string
let oldDir: string
let newDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'lankapos-userdata-migration-test-'))
  oldDir = join(tempDir, 'LankaPOS-bookshop')
  newDir = join(tempDir, 'LankaPOS')
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('migrateLegacyUserData', () => {
  it('copies the database (and WAL/SHM sidecars) and backups folder from the old userData dir to the new one', async () => {
    await mkdir(oldDir, { recursive: true })
    await writeFile(join(oldDir, 'lankapos-bookshop.db'), 'db-contents')
    await writeFile(join(oldDir, 'lankapos-bookshop.db-wal'), 'wal-contents')
    await writeFile(join(oldDir, 'lankapos-bookshop.db-shm'), 'shm-contents')
    await mkdir(join(oldDir, 'backups'), { recursive: true })
    await writeFile(join(oldDir, 'backups', 'lankapos-backup-20260101-120000.db'), 'backup-contents')

    await migrateLegacyUserData(oldDir, newDir)

    expect(await readFile(join(newDir, 'lankapos-bookshop.db'), 'utf8')).toBe('db-contents')
    expect(await readFile(join(newDir, 'lankapos-bookshop.db-wal'), 'utf8')).toBe('wal-contents')
    expect(await readFile(join(newDir, 'lankapos-bookshop.db-shm'), 'utf8')).toBe('shm-contents')
    expect(await readFile(join(newDir, 'backups', 'lankapos-backup-20260101-120000.db'), 'utf8')).toBe(
      'backup-contents'
    )

    // the old folder is left in place, not deleted
    expect(await readFile(join(oldDir, 'lankapos-bookshop.db'), 'utf8')).toBe('db-contents')
  })

  it('does nothing on a fresh install where neither folder has a database yet', async () => {
    await migrateLegacyUserData(oldDir, newDir)

    await expect(readFile(join(newDir, 'lankapos-bookshop.db'), 'utf8')).rejects.toThrow()
  })

  it('does not overwrite a database that already exists at the new location', async () => {
    await mkdir(oldDir, { recursive: true })
    await writeFile(join(oldDir, 'lankapos-bookshop.db'), 'old-contents')

    await mkdir(newDir, { recursive: true })
    await writeFile(join(newDir, 'lankapos-bookshop.db'), 'new-contents-already-here')

    await migrateLegacyUserData(oldDir, newDir)

    expect(await readFile(join(newDir, 'lankapos-bookshop.db'), 'utf8')).toBe('new-contents-already-here')
  })
})
