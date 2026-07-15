import { app, dialog, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db'
import { registerInventoryIpc } from './ipc/inventory'
import { registerSalesIpc } from './ipc/sales'
import { registerRegisterIpc } from './ipc/register'
import { registerCustomersIpc } from './ipc/customers'
import { registerSuppliersIpc } from './ipc/suppliers'
import { registerPurchasingIpc } from './ipc/purchasing'
import { registerPreordersIpc } from './ipc/preorders'
import { registerPricingIpc } from './ipc/pricing'
import { registerReportsIpc } from './ipc/reports'
import { registerReturnsIpc } from './ipc/returns'
import { registerSessionIpc, loadIdleTimeoutSetting } from './ipc/session'
import { registerUsersIpc } from './ipc/users'
import { registerBackupIpc } from './ipc/backup'
import { runScheduledBackupIfDue } from './backup/backupService'
import { registerAuditIpc } from './ipc/audit'
import { registerSettingsIpc } from './ipc/settings'
import { registerQuotationsIpc } from './ipc/quotations'

const BACKUP_CHECK_INTERVAL_MS = 15 * 60 * 1000

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.lankapos.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const { db } = await initDatabase()
    await loadIdleTimeoutSetting(db)
    registerSessionIpc(db)
    registerUsersIpc(db)
    registerInventoryIpc(db)
    registerSalesIpc(db)
    registerRegisterIpc(db)
    registerCustomersIpc(db)
    registerSuppliersIpc(db)
    registerPurchasingIpc(db)
    registerPreordersIpc(db)
    registerPricingIpc(db)
    registerReportsIpc(db)
    registerReturnsIpc(db)
    registerBackupIpc(db)
    registerAuditIpc(db)
    registerSettingsIpc(db)
    registerQuotationsIpc(db)

    const defaultBackupFolder = join(app.getPath('userData'), 'backups')
    const checkScheduledBackup = (): void => {
      runScheduledBackupIfDue(db, defaultBackupFolder).catch((err) =>
        console.error('[backup] scheduled backup check failed', err)
      )
    }
    checkScheduledBackup()
    setInterval(checkScheduledBackup, BACKUP_CHECK_INTERVAL_MS)
  } catch (error) {
    console.error('[db] failed to initialize database', error)
    dialog.showErrorBox(
      'Database error',
      'LankaPOS could not open its database and must close. If this keeps happening, restore from a backup.'
    )
    app.quit()
    return
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
