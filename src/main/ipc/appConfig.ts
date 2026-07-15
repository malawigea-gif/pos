import { app, ipcMain } from 'electron'
import { loadAppConfig, saveAppConfig } from '../config/appConfig'
import { testPostgresConnection } from '../db/client-postgres'
import type { AppConfig, ConnectionTestResult, NetworkedDbConfig } from '../../shared/appConfig'

/** Deliberately unguarded — unlike every other admin-only channel in this
 *  app (see errors.ts's withRole). This has to work with *no session at
 *  all*: it's the only way to fix a Networked-mode connection typo from the
 *  startup-failure recovery screen (see system:getStartupStatus in
 *  index.ts), which by definition has no database connection and therefore
 *  no way to look up or check a user's role in the first place. The
 *  renderer still only exposes the write action to a logged-in admin during
 *  normal in-app use (Settings' Server Connection section) — this is the
 *  layer *below* that UI gate, not a replacement for it. Worst case for a
 *  non-admin misusing this via devtools: they mis-point their own till at a
 *  different (or the same) server, which only breaks that one till after
 *  its next restart — no shared data is read or written through this file. */
export function registerAppConfigIpc(): void {
  ipcMain.handle('appConfig:get', (): Promise<AppConfig> => loadAppConfig(app.getPath('userData')))

  ipcMain.handle('appConfig:set', async (_event, input: AppConfig): Promise<void> => {
    await saveAppConfig(app.getPath('userData'), input)
  })

  ipcMain.handle(
    'appConfig:testConnection',
    async (_event, config: NetworkedDbConfig): Promise<ConnectionTestResult> => {
      try {
        await testPostgresConnection(config)
        return { ok: true }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  // Networked-mode config only takes effect on a fresh connect — see
  // PROJECT_OVERVIEW.md §2. Reused by both the Settings save flow (after
  // changing mode/connection details) and the startup-failure screen's
  // Retry button (which just re-runs the exact same boot sequence).
  ipcMain.handle('appConfig:relaunch', (): void => {
    app.relaunch()
    app.exit(0)
  })
}
