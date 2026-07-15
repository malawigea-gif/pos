import type { Selectable } from 'kysely'
import type { AppLanguage, UserRole, UsersTable } from '../main/db/types'

export type { AppLanguage, UserRole }
export type SafeUser = Omit<Selectable<UsersTable>, 'password_hash'>

export interface CreateUserRequest {
  username: string
  password: string
  fullName: string
  role: UserRole
  language: AppLanguage
}

export interface UpdateUserRequest {
  fullName?: string
  role?: UserRole
  language?: AppLanguage
}
