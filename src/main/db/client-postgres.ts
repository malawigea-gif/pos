import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import type { NetworkedDbConfig } from '../config/appConfig'
import type { Database } from './types'

export interface PgConnection {
  pool: Pool
  db: Kysely<Database>
}

function toPoolConfig(config: NetworkedDbConfig): ConstructorParameters<typeof Pool>[0] {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password
  }
}

export function createPostgresDatabase(config: NetworkedDbConfig): PgConnection {
  const pool = new Pool(toPoolConfig(config))

  // A pool-managed client can emit an error on its own (e.g. the server
  // restarting, or a network drop on an otherwise-idle connection) outside
  // of any query in flight. Without a listener here, Node treats that as an
  // uncaught exception and crashes the whole main process — pg's own
  // retry/backoff on the next checkout is enough recovery, this just has to
  // not be fatal.
  pool.on('error', (err) => {
    console.error('[db] postgres pool error', err)
  })

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  })

  return { pool, db }
}

/** Used by the Settings "Test connection" action and by startup failure
 *  handling — opens and immediately releases one client rather than reusing
 *  the app's long-lived pool, so a bad config never leaves a broken pool
 *  behind. */
export async function testPostgresConnection(config: NetworkedDbConfig): Promise<void> {
  const pool = new Pool({ ...toPoolConfig(config), connectionTimeoutMillis: 5000, max: 1 })
  try {
    const client = await pool.connect()
    client.release()
  } finally {
    await pool.end()
  }
}
