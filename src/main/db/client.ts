import SqliteDatabase from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import type { Database } from './types'

export interface DbConnection {
  sqlite: SqliteDatabase.Database
  db: Kysely<Database>
}

export function createDatabase(filePath: string): DbConnection {
  const sqlite = new SqliteDatabase(filePath)

  // WAL mode + NORMAL synchronous is the standard durability/performance
  // balance for SQLite under WAL: survives sudden power loss without
  // corruption, without paying full fsync cost on every write.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite })
  })

  return { sqlite, db }
}
