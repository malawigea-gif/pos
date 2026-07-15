// @types/better-sqlite3 doesn't declare Database#backup(), even though the
// installed runtime (12.x) supports it as a hot, WAL-safe backup API.
import 'better-sqlite3'

declare module 'better-sqlite3' {
  interface Database {
    backup(
      destinationFile: string,
      options?: {
        attached?: string
        progress?: (info: { totalPages: number; remainingPages: number }) => number
      }
    ): Promise<{ totalPages: number; remainingPages: number }>
  }
}
