import { ipcMain } from 'electron'
import { selectExecutable } from './dialogs'
import {
  getProcessStatus,
  killProcess,
  launchProcess,
  restartProcess,
} from './processManager'

export function registerIpcHandlers(): void {
  ipcMain.handle('process:status', (_event, processName: string) =>
    getProcessStatus(processName),
  )
  ipcMain.handle('process:kill', (_event, processName: string) =>
    killProcess(processName),
  )
  ipcMain.handle('process:restart', (_event, processName: string) =>
    restartProcess(processName),
  )
  ipcMain.handle('process:launch', (_event, exePath: string) =>
    launchProcess(exePath),
  )
  ipcMain.handle('dialog:selectExecutable', () => selectExecutable())
}
