import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { getDb } from '../db'
import { migrateSqliteToPostgres, MigrationRequiresNetworkedModeError } from '../migration/sqliteToPostgresMigration'
import { ipcHandler, withRole } from './errors'
import type { MigrationRowCounts } from '../../shared/migration'

const ADMIN_ONLY = ['admin'] as const

// The pre-rename filename (see PROJECT_OVERVIEW.md §4/§6) is still what
// every install actually uses on disk — only suggested as this dialog's
// starting point, the admin can browse to a different backup .db instead.
const LEGACY_DB_FILENAME = 'lankapos-bookshop.db'

export function registerMigrationIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'migration:pickSourceFile',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (): Promise<string | null> => {
        const options = {
          properties: ['openFile' as const],
          defaultPath: join(app.getPath('userData'), LEGACY_DB_FILENAME),
          filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        }
        const focusedWindow = BrowserWindow.getFocusedWindow()
        const result = focusedWindow
          ? await dialog.showOpenDialog(focusedWindow, options)
          : await dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) return null
        return result.filePaths[0]
      })
    )
  )

  ipcMain.handle(
    'migration:run',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (sourceFilePath: string): Promise<MigrationRowCounts> => {
        // getDb() is the app's own live connection — this only makes sense
        // once this till is already connected to the server it should
        // import into, not the old Standalone file it's importing from.
        if (getDb().mode !== 'networked') throw new MigrationRequiresNetworkedModeError()
        return migrateSqliteToPostgres(sourceFilePath, db)
      })
    )
  )
}
