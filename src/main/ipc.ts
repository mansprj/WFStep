import { app, ipcMain } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { selectExecutable, selectImage } from './dialogs'
import { addApp, listApps, removeApp, updateApp } from './appsManager'
import {
  getProcessStatus,
  killProcess,
  killProcessByExe,
  launchProcess,
  restartExe,
  restartProcess,
} from './processManager'
import { executeAction } from './actions/executor'
import {
  addWorkflow,
  listWorkflows,
  removeWorkflow,
  updateWorkflow,
} from './workflowsManager'
import { cancelWorkflowRun, startWorkflowRun } from './workflowRunner'
import { isAutomationAction } from '@shared/actions'
import type { ActionResult } from '@shared/types'

const IMAGE_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
}

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
  ipcMain.handle('process:killExe', (_event, exePath: string) =>
    killProcessByExe(exePath),
  )
  ipcMain.handle('process:restartExe', (_event, exePath: string) =>
    restartExe(exePath),
  )
  ipcMain.handle('process:launch', (_event, exePath: string) =>
    launchProcess(exePath),
  )
  ipcMain.handle('dialog:selectExecutable', () => selectExecutable())
  ipcMain.handle('dialog:selectImage', () => selectImage())
  ipcMain.handle('icon:get', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      return null
    }
    const path = filePath.trim()
    if (!existsSync(path)) {
      return null
    }
    const mime = IMAGE_EXTENSIONS[extname(path).toLowerCase()]
    if (mime !== undefined) {
      try {
        const data = readFileSync(path)
        return `data:${mime};base64,${data.toString('base64')}`
      } catch {
        return null
      }
    }
    try {
      const image = await app.getFileIcon(path, { size: 'large' })
      return image.isEmpty() ? null : image.toDataURL()
    } catch {
      return null
    }
  })
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
  ipcMain.handle('workflows:list', () => listWorkflows())
  ipcMain.handle('workflows:add', (_event, value: unknown) => addWorkflow(value))
  ipcMain.handle('workflows:update', (_event, id: unknown, value: unknown) =>
    updateWorkflow(id, value),
  )
  ipcMain.handle('workflows:remove', (_event, id: unknown) => removeWorkflow(id))
  ipcMain.handle('workflows:run', (event, id: unknown) => {
    if (typeof id !== 'string') {
      return { success: false, message: 'Invalid workflow id.' }
    }
    const workflow = listWorkflows().find((entry) => entry.id === id)
    if (workflow === undefined) {
      return { success: false, message: 'Workflow not found.' }
    }
    return startWorkflowRun(event, workflow)
  })
  ipcMain.handle('workflows:cancel', () => {
    if (cancelWorkflowRun()) {
      return { success: true, message: 'Cancelling…' }
    }
    return { success: false, message: 'No workflow is running.' }
  })
}
