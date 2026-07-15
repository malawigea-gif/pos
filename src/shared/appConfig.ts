export type DatabaseMode = 'standalone' | 'networked'

export interface NetworkedDbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export type AppConfig = { mode: 'standalone' } | { mode: 'networked'; networked: NetworkedDbConfig }

export type ConnectionTestResult = { ok: true } | { ok: false; message: string }

/** What App.tsx checks before deciding whether to render the normal
 *  login/app shell or the Networked-mode "can't reach the server" recovery
 *  screen. `mode` is included even on success so the renderer never has to
 *  separately ask which mode is active. */
export interface StartupStatus {
  ok: boolean
  mode: DatabaseMode
  error?: string
}
