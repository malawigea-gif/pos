import { ipcMain } from 'electron'
import { sql, type Kysely } from 'kysely'
import type { Database } from '../db/types'
import { ipcHandler } from './errors'

/** A trivial round-trip query the renderer polls, but only while
 *  ConnectionBanner.tsx is actually showing "connection lost" — every
 *  successful IPC call already clears the banner on its own (see preload's
 *  invoke() wrapper), this just gives the recovery something to poll when
 *  the user isn't actively doing anything else. */
export function registerSystemIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'system:ping',
    ipcHandler(async (): Promise<void> => {
      await sql`select 1`.execute(db)
    })
  )
}
