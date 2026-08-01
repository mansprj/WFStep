import { ipcMain } from 'electron'
import { addApp, listApps, removeApp, updateApp } from './appsManager'
import { selectExecutable } from './dialogs'
import {
  getProcessStatus,
  killProcess,
  launchProcess,
  restartProcess,
} from './processManager'
import { executeAction } from './actions/executor'
import { isAutomationAction } from '@shared/actions'
import type { ActionResult } from '@shared/types'

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
  ipcMain.handle('action:run', (_event, value: unknown) => {
    if (!isAutomationAction(value)) {
      return { success: false, message: 'Invalid action.' } satisfies ActionResult
    }
    return executeAction(value)
  })
  ipcMain.handle('apps:list', () => listApps())
  ipcMain.handle('apps:add', (_event, value: unknown) => addApp(value))
  ipcMain.handle('apps:update', (_event, id: unknown, value: unknown) =>
    updateApp(id, value),
  )
  ipcMain.handle('apps:remove', (_event, id: unknown) => removeApp(id))
}
