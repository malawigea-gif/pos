import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { getDbPath, getStandaloneSqlite } from '../db'
import { getSession } from '../auth/session'
import {
  getBackupSettings,
  updateBackupSettings,
  listBackups,
  runBackupNow,
  restoreDatabaseFile
} from '../backup/backupService'
import { ipcHandler, withRole } from './errors'
import type { BackupFileInfo, BackupSettings, UpdateBackupSettingsRequest } from '../../shared/backup'

const ADMIN_ONLY = ['admin'] as const

function getDefaultBackupFolder(): string {
  return join(app.getPath('userData'), 'backups')
}

export function registerBackupIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'backup:getSettings',
    ipcHandler(
      withRole([...ADMIN_ONLY], (): Promise<BackupSettings> => getBackupSettings(db, getDefaultBackupFolder()))
    )
  )

  ipcMain.handle(
    'backup:updateSettings',
    ipcHandler(
      withRole([...ADMIN_ONLY], (input: UpdateBackupSettingsRequest): Promise<BackupSettings> => {
        const session = getSession()
        return updateBackupSettings(db, getDefaultBackupFolder(), input, session?.userId ?? null)
      })
    )
  )

  ipcMain.handle(
    'backup:pickFolder',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (): Promise<string | null> => {
        const options = { properties: ['openDirectory' as const, 'createDirectory' as const] }
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
    'backup:list',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (): Promise<BackupFileInfo[]> => {
        const settings = await getBackupSettings(db, getDefaultBackupFolder())
        return listBackups(settings.folder)
      })
    )
  )

  ipcMain.handle(
    'backup:runNow',
    ipcHandler(
      withRole([...ADMIN_ONLY], (): Promise<BackupFileInfo> => {
        const session = getSession()
        return runBackupNow(db, getDefaultBackupFolder(), session?.userId ?? null)
      })
    )
  )

  ipcMain.handle(
    'backup:pickRestoreFile',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (): Promise<string | null> => {
        const options = {
          properties: ['openFile' as const],
          filters: [{ name: 'Database Backup', extensions: ['db'] }]
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
    'backup:restore',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (filePath: string): Promise<void> => {
        await restoreDatabaseFile(getStandaloneSqlite(), getDbPath(), filePath)
        // Give the resolved response a moment to reach the renderer before
        // the process exits — the app must restart to safely reopen a
        // freshly-swapped database file with a clean connection/IPC state.
        setTimeout(() => {
          app.relaunch()
          app.exit(0)
        }, 300)
      })
    )
  )

  ipcMain.handle(
    'backup:openFolder',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (): Promise<void> => {
        const settings = await getBackupSettings(db, getDefaultBackupFolder())
        await mkdir(settings.folder, { recursive: true })
        await shell.openPath(settings.folder)
      })
    )
  )
}
