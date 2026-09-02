import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import electronUpdater from 'electron-updater'
import { registerIpcHandlers } from './ipc'
import { clearHotkeys, refreshHotkeys } from './hotkeyManager'
import { cleanupMacroController } from './macroController'

const { autoUpdater } = electronUpdater

type UpdateStatus = 'idle' | 'available' | 'downloaded'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let updateStatus: UpdateStatus = 'idle'

function log(msg: string): void {
  console.log(`[updater] ${msg}`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    const escaped = JSON.stringify(`[updater] ${msg}`)
    mainWindow.webContents.executeJavaScript(`console.log(${escaped})`)
  }
}

function pushUpdateStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', updateStatus)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      // ESM preload scripts require the sandbox to be disabled.
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (mainWindow === null) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.logger = { info: (m) => log(String(m)), warn: (m) => log(`WARN: ${m}`), error: (m) => log(`ERROR: ${m}`), debug: (m) => log(String(m)) }

  ipcMain.on('updates:download', () => {
    autoUpdater.downloadUpdate()
  })
  ipcMain.on('updates:install', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('update-available', async () => {
    log('update available')
    updateStatus = 'available'
    pushUpdateStatus()
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Доступно обновление',
      message: 'Вышла новая версия программы',
      detail: 'Скачать и установить её сейчас?',
      buttons: ['Скачать', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) {
      autoUpdater.downloadUpdate()
    }
  })

  autoUpdater.on('update-downloaded', async () => {
    log('update downloaded')
    updateStatus = 'downloaded'
    pushUpdateStatus()
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Обновление готово',
      message: 'Новая версия скачана',
      detail: 'Перезапустить программу для установки?',
      buttons: ['Перезапустить', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('update-not-available', () => {
    log('no update available')
  })

  autoUpdater.on('error', (err) => {
    log(`error: ${err.message}`)
  })

  log(`current version: ${app.getVersion()}`)
  autoUpdater.checkForUpdates().catch((err) => {
    log(`checkForUpdates failed: ${err.message}`)
  })

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log(`periodic check failed: ${err.message}`)
    })
  }, 60 * 60 * 1000)
}

function createTray(): void {
  const icon = nativeImage.createFromPath(
    join(app.getAppPath(), 'resources', 'tray.png'),
  )
  tray = new Tray(icon)
  tray.setToolTip('WF Step')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open WF Step', click: () => showWindow() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => showWindow())
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showWindow()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    refreshHotkeys()
    createWindow()
    setupAutoUpdater()
    createTray()

    app.on('activate', () => {
      showWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit()
    }
  })

  app.on('will-quit', () => {
    clearHotkeys()
    cleanupMacroController()
  })
}
