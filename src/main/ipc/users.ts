import { ipcMain } from 'electron'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types'
import * as users from '../db/repositories/usersRepository'
import { getCurrentUserId } from '../auth/session'
import { ipcHandler, withRole } from './errors'
import type { CreateUserRequest, UpdateUserRequest } from '../../shared/users'

const ADMIN_ONLY = ['admin'] as const

export function registerUsersIpc(db: Kysely<Database>): void {
  ipcMain.handle(
    'users:list',
    ipcHandler(withRole([...ADMIN_ONLY], () => users.listUsers(db)))
  )

  ipcMain.handle(
    'users:get',
    ipcHandler(withRole([...ADMIN_ONLY], (id: number) => users.getUserById(db, id)))
  )

  ipcMain.handle(
    'users:create',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (input: CreateUserRequest) => {
        const userId = getCurrentUserId()
        return users.createUser(db, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'users:update',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, input: UpdateUserRequest) => {
        const userId = getCurrentUserId()
        return users.updateUser(db, id, { ...input, userId })
      })
    )
  )

  ipcMain.handle(
    'users:setActive',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, isActive: boolean) => {
        const userId = getCurrentUserId()
        return users.setUserActive(db, id, isActive, userId)
      })
    )
  )

  ipcMain.handle(
    'users:resetPassword',
    ipcHandler(
      withRole([...ADMIN_ONLY], async (id: number, newPassword: string) => {
        const userId = getCurrentUserId()
        await users.changePassword(db, id, newPassword, userId)
      })
    )
  )
}
