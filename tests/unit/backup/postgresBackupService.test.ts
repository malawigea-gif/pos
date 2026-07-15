import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createPgBackupFile,
  PgToolNotFoundError,
  restorePgBackupFile,
  validatePgBackupFile
} from '../../../src/main/backup/postgresBackupService'
import type { NetworkedDbConfig } from '../../../src/shared/appConfig'

// This machine's PATH genuinely has no pg_dump/pg_restore (verified: `where
// pg_dump` finds nothing here even though PostgreSQL 15 is installed at a
// non-PATH location) — which conveniently lets the PgToolNotFoundError path
// itself be tested for real, via an actual spawn() ENOENT, rather than
// mocked. What this can't test without a real reachable Postgres server is
// the success path (an actual dump/restore round-trip) — see
// tests/integration/postgresMigrations.test.ts's TEST_POSTGRES_URL gating
// for that; this file only covers what's true regardless of whether a
// server is reachable.
const config: NetworkedDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'lankapos_test',
  user: 'postgres',
  password: 'postgres'
}

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'lankapos-pgbackup-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('postgresBackupService: PgToolNotFoundError', () => {
  it('createPgBackupFile rejects with PgToolNotFoundError when pg_dump is not on PATH', async () => {
    await expect(createPgBackupFile(config, tempDir)).rejects.toBeInstanceOf(PgToolNotFoundError)
  })

  it('validatePgBackupFile rejects with PgToolNotFoundError when pg_restore is not on PATH', async () => {
    const filePath = join(tempDir, 'whatever.dump')
    await writeFile(filePath, 'irrelevant content — pg_restore itself is unreachable')
    await expect(validatePgBackupFile(filePath)).rejects.toBeInstanceOf(PgToolNotFoundError)
  })

  it('restorePgBackupFile surfaces the same PgToolNotFoundError from its validate step', async () => {
    const filePath = join(tempDir, 'whatever.dump')
    await writeFile(filePath, 'irrelevant content — pg_restore itself is unreachable')
    await expect(restorePgBackupFile(config, filePath)).rejects.toBeInstanceOf(PgToolNotFoundError)
  })
})
