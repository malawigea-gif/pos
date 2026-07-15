import type { AppLanguage, UserRole } from '../main/db/types'

export interface SessionInfo {
  userId: number
  username: string
  fullName: string
  role: UserRole
  language: AppLanguage
  locked: boolean
}

export interface LoginRequest {
  username: string
  password: string
}
