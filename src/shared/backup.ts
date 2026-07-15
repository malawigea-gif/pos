export interface BackupSettings {
  folder: string
  autoEnabled: boolean
  intervalHours: number
  retentionCount: number
  lastBackupAt: string | null
}

export interface UpdateBackupSettingsRequest {
  folder?: string
  autoEnabled?: boolean
  intervalHours?: number
  retentionCount?: number
}

export interface BackupFileInfo {
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: string
}
