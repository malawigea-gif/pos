import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import { getBusinessProfile, setBusinessProfile } from '../db/repositories/settingsRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type { BusinessProfile } from '../../shared/settings'

export function registerSettingsIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'settings:profile:get',
    ipcHandler((): Promise<BusinessProfile> => getBusinessProfile(db))
  )

  ipcMain.handle(
    'settings:profile:set',
    ipcHandler(
      withRole(['admin', 'manager'], async (input: BusinessProfile): Promise<BusinessProfile> => {
        const userId = getCurrentUserId()
        return setBusinessProfile(db, input, userId)
      })
    )
  )
}
