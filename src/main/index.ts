import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import electronUpdater from 'electron-updater'
import { registerIpcHandlers } from './ipc'
import { clearHotkeys, refreshHotkeys } from './hotkeyManager'

const { autoUpdater } = electronUpdater

type UpdateStatus = 'idle' | 'available' | 'downloaded'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let updateStatus: UpdateStatus = 'idle'

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

  ipcMain.on('updates:download', () => {
    autoUpdater.downloadUpdate()
  })
  ipcMain.on('updates:install', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('update-available', async () => {
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

  autoUpdater.on('error', () => {
    // Ignore update errors silently — the app must keep working regardless.
  })

  autoUpdater.checkForUpdates().catch(() => {})
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
    setupAutoUpdater()
    registerIpcHandlers()
    refreshHotkeys()
    createWindow()
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
  })
}
