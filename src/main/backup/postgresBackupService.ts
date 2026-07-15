import { spawn } from 'child_process'
import { mkdir, stat } from 'fs/promises'
import { join } from 'path'
import type { NetworkedDbConfig } from '../../shared/appConfig'
import type { BackupFileInfo } from '../../shared/backup'

export class PgToolNotFoundError extends Error {
  constructor(public readonly tool: 'pg_dump' | 'pg_restore') {
    super(`${tool} was not found on this PC's PATH.`)
    this.name = 'PgToolNotFoundError'
  }
}

export class PgBackupFailedError extends Error {
  constructor(
    public readonly tool: 'pg_dump' | 'pg_restore',
    public readonly stderr: string
  ) {
    super(`${tool} failed: ${stderr || 'unknown error'}`)
    this.name = 'PgBackupFailedError'
  }
}

export class InvalidPgBackupFileError extends Error {
  constructor(reason: string) {
    super(`This doesn't look like a valid pg_dump backup file (${reason}).`)
    this.name = 'InvalidPgBackupFileError'
  }
}

function buildBackupFileName(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `lankapos-backup-${date}-${time}.dump`
}

/** Runs a Postgres client tool (pg_dump/pg_restore) as a child process,
 *  connecting to the configured server exactly the way the app's own `pg`
 *  pool does — this is a genuinely new external dependency the SQLite
 *  file-copy path never needed: whichever PC clicks "Backup Now" or
 *  "Restore" needs these tools installed and on PATH (see the Networked
 *  mode note in BackupPage.tsx and USER_GUIDE.md). The password is passed
 *  via the PGPASSWORD env var — the standard non-interactive approach for
 *  these CLI tools — scoped to just this one child process, not persisted
 *  anywhere. */
function runPgTool(tool: 'pg_dump' | 'pg_restore', args: string[], password?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, {
      env: password !== undefined ? { ...process.env, PGPASSWORD: password } : process.env,
      windowsHide: true
    })

    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') reject(new PgToolNotFoundError(tool))
      else reject(err)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new PgBackupFailedError(tool, stderr.trim()))
    })
  })
}

export async function createPgBackupFile(config: NetworkedDbConfig, folder: string): Promise<BackupFileInfo> {
  await mkdir(folder, { recursive: true })
  const fileName = buildBackupFileName()
  const filePath = join(folder, fileName)

  await runPgTool(
    'pg_dump',
    ['-h', config.host, '-p', String(config.port), '-U', config.user, '-Fc', '-f', filePath, config.database],
    config.password
  )

  const stats = await stat(filePath)
  return { fileName, filePath, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() }
}

/** `pg_restore --list` only reads the archive's own table of contents — no
 *  server connection involved — so this is as cheap a pre-flight sanity
 *  check as SQLite's validateBackupFile() before attempting a destructive
 *  restore, and needs no host/credentials. */
export async function validatePgBackupFile(filePath: string): Promise<void> {
  try {
    await runPgTool('pg_restore', ['--list', filePath])
  } catch (err) {
    if (err instanceof PgToolNotFoundError) throw err
    throw new InvalidPgBackupFileError('not a valid pg_dump custom-format archive')
  }
}

/** `--clean --if-exists` makes this safe to run against a server that
 *  already has the current schema/data — every existing object is dropped
 *  (if present) before being recreated from the dump, the same "restore
 *  fully replaces what's there" semantics as overwriting the SQLite file in
 *  Standalone mode. */
export async function restorePgBackupFile(config: NetworkedDbConfig, backupFilePath: string): Promise<void> {
  await validatePgBackupFile(backupFilePath)
  await runPgTool(
    'pg_restore',
    [
      '-h',
      config.host,
      '-p',
      String(config.port),
      '-U',
      config.user,
      '-d',
      config.database,
      '--clean',
      '--if-exists',
      backupFilePath
    ],
    config.password
  )
}
