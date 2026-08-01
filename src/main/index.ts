import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { clearHotkeys, refreshHotkeys } from './hotkeyManager'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

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

function createTray(): void {
  const icon = nativeImage.createFromPath(
    join(app.getAppPath(), 'resources', 'tray.png'),
  )
  tray = new Tray(icon)
  tray.setToolTip('AutomationHub')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open AutomationHub', click: () => showWindow() },
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

app.whenReady().then(() => {
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
