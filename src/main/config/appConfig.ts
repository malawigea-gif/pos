import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export type DatabaseMode = 'standalone' | 'networked'

export interface NetworkedDbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export type AppConfig =
  | { mode: 'standalone' }
  | { mode: 'networked'; networked: NetworkedDbConfig }

const STANDALONE_CONFIG: AppConfig = { mode: 'standalone' }
const CONFIG_FILENAME = 'app-config.json'

export function appConfigPath(userDataDir: string): string {
  return join(userDataDir, CONFIG_FILENAME)
}

/** Read before `initDatabase()` runs, so it can't live inside the database
 *  itself — it's what decides which database to even connect to. Takes an
 *  explicit directory (rather than calling `app.getPath()` itself) so this
 *  stays Electron-free and unit-testable, matching this module's siblings
 *  (`migrateLegacyUserData`, `backupService`). Any malformed/missing file
 *  falls back to Standalone rather than throwing, since a fresh install has
 *  no config file yet and that must not be treated as an error. */
export async function loadAppConfig(userDataDir: string): Promise<AppConfig> {
  try {
    const raw = await readFile(appConfigPath(userDataDir), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    if (parsed.mode === 'networked' && parsed.networked) {
      return { mode: 'networked', networked: parsed.networked }
    }
    return STANDALONE_CONFIG
  } catch {
    return STANDALONE_CONFIG
  }
}

export async function saveAppConfig(userDataDir: string, config: AppConfig): Promise<void> {
  await mkdir(userDataDir, { recursive: true })
  await writeFile(appConfigPath(userDataDir), JSON.stringify(config, null, 2), 'utf8')
}
