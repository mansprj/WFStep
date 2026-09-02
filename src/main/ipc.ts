import { app, ipcMain, net } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { selectExecutable, selectFolder, selectImage } from './dialogs'
import {
  findProcessPath,
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
import { hotkeyIssue, refreshHotkeys } from './hotkeyManager'
import { clearLogs, listLogs, logEvent } from './logManager'
import { readSettings, writeSettings } from './settingsManager'
import type { Settings } from './settingsManager'

const THEMES = new Set(['graphite-amber', 'light', 'blue', 'system'])

function isTheme(value: unknown): value is string {
  return typeof value === 'string' && THEMES.has(value)
}
import {
  discardRecording,
  getMacroState,
  getPendingSteps,
  startPlayback,
  startRecording,
  stopPlayback,
  stopRecording,
} from './macroController'
import { addMacro, listMacros, removeMacro, updateMacro } from './macroManager'
import { isAutomationAction } from '@shared/actions'
import { isPlaybackConfig, isValidMacroStep } from '@shared/macros'
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

async function iconForFile(filePath: string): Promise<string | null> {
  const mime = IMAGE_EXTENSIONS[extname(filePath).toLowerCase()]
  if (mime !== undefined) {
    try {
      const data = readFileSync(filePath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  }
  try {
    const image = await app.getFileIcon(filePath, { size: 'large' })
    return image.isEmpty() ? null : image.toDataURL()
  } catch {
    return null
  }
}

async function fetchDataUrl(
  url: string,
  mime: string,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await net.fetch(url, { signal: controller.signal })
    if (!response.ok) {
      return null
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) {
      return null
    }
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code)),
    )
}

// Page <title> for the openUrl action, e.g. "Google Переводчик" for a
// translate.google.com URL. Falls back to null when the page has no title.
async function pageTitleForUrl(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await net.fetch(parsed.href, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8' },
    })
    if (!response.ok) {
      return null
    }
    const html = await response.text()
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    if (match === null) {
      return null
    }
    const title = decodeHtmlEntities(match[1])
      .replace(/\s+/g, ' ')
      .trim()
    if (title.length === 0) {
      return null
    }
    return title.length > 60 ? `${title.slice(0, 57)}…` : title
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Website favicon for the openUrl action. Tries Google's favicon service first,
// then the origin's favicon.ico. Returns null when the site has no icon.
async function faviconForUrl(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.hostname.length === 0) {
    return null
  }

  const fromService = await fetchDataUrl(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
    'image/png',
    5000,
  )
  if (fromService !== null) {
    return fromService
  }

  return fetchDataUrl(`${parsed.origin}/favicon.ico`, 'image/x-icon', 5000)
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
  ipcMain.handle('dialog:selectFolder', () => selectFolder())
  ipcMain.handle('icon:get', async (_event, value: unknown) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null
    }
    const input = value.trim()
    if (existsSync(input)) {
      return iconForFile(input)
    }
    // Not a path on disk: treat it as a running process name and resolve
    // its executable to extract the icon (like Task Manager does).
    const exePath = await findProcessPath(input)
    if (exePath === null) {
      return null
    }
    return iconForFile(exePath)
  })
  ipcMain.handle('favicon:get', (_event, value: unknown) => {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) {
      return null
    }
    return faviconForUrl(value.trim())
  })
  ipcMain.handle('page:title', (_event, value: unknown) => {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) {
      return null
    }
    return pageTitleForUrl(value.trim())
  })
  ipcMain.handle('action:run', (_event, value: unknown) => {
    if (!isAutomationAction(value)) {
      return { success: false, message: 'Invalid action.' } satisfies ActionResult
    }
    return executeAction(value, { source: 'action', context: 'Action Runner' })
  })
  ipcMain.handle('logs:list', () => listLogs())
  ipcMain.handle('logs:clear', () => {
    clearLogs()
    return { success: true, message: 'Logs cleared.' }
  })
  ipcMain.handle('workflows:list', () => listWorkflows())
  ipcMain.handle('workflows:add', (_event, value: unknown) => {
    const result = addWorkflow(value)
    if (result.success) {
      refreshHotkeys()
      const issue =
        result.workflow?.hotkey !== null && result.workflow !== undefined
          ? hotkeyIssue(result.workflow.id)
          : null
      if (issue !== null) {
        return { ...result, message: `${result.message} ${issue}` }
      }
    }
    return result
  })
  ipcMain.handle('workflows:update', (_event, id: unknown, value: unknown) => {
    const result = updateWorkflow(id, value)
    if (result.success) {
      refreshHotkeys()
      const issue =
        result.workflow?.hotkey !== null && result.workflow !== undefined
          ? hotkeyIssue(result.workflow.id)
          : null
      if (issue !== null) {
        return { ...result, message: `${result.message} ${issue}` }
      }
    }
    return result
  })
  ipcMain.handle('workflows:remove', (_event, id: unknown) => {
    const result = removeWorkflow(id)
    if (result.success) {
      refreshHotkeys()
    }
    return result
  })
  ipcMain.handle('workflows:run', (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return { success: false, message: 'Invalid workflow id.' }
    }
    const workflow = listWorkflows().find((entry) => entry.id === id)
    if (workflow === undefined) {
      return { success: false, message: 'Workflow not found.' }
    }
    return startWorkflowRun(workflow)
  })
  ipcMain.handle('workflows:cancel', () => {
    if (cancelWorkflowRun()) {
      return { success: true, message: 'Cancelling…' }
    }
    return { success: false, message: 'No workflow is running.' }
  })
  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_event, value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return readSettings()
    }
    const partial = value as Record<string, unknown>
    if (partial.theme !== undefined && !isTheme(partial.theme)) {
      delete partial.theme
    }
    const updated = writeSettings(partial as Partial<Settings>)
    if (process.platform === 'win32') {
      app.setLoginItemSettings({ openAtLogin: updated.autostart })
    }
    if (partial.commandHotkeys !== undefined && typeof partial.commandHotkeys === 'object') {
      refreshHotkeys()
    }
    return updated
  })
  ipcMain.handle('macros:list', () => listMacros())
  ipcMain.handle('macros:add', (_event, value: unknown) => {
    const result = addMacro(value)
    if (result.success) {
      logEvent({
        source: 'macro',
        context: value &&
          typeof value === 'object' &&
          typeof (value as Record<string, unknown>).name === 'string'
          ? ((value as Record<string, unknown>).name as string)
          : 'Macro',
        actionType: 'save',
        success: true,
        message: 'Macro saved.',
      })
    }
    return result
  })
  ipcMain.handle('macros:update', (_event, id: unknown, value: unknown) =>
    updateMacro(id, value),
  )
  ipcMain.handle('macros:remove', (_event, id: unknown) => removeMacro(id))
  ipcMain.handle('macros:record:start', () => startRecording())
  ipcMain.handle('macros:record:stop', () => stopRecording())
  ipcMain.handle('macros:record:discard', () => {
    discardRecording()
    return { success: true, message: 'Recording discarded.' }
  })
  ipcMain.handle('macros:record:pending', () => getPendingSteps())
  ipcMain.handle('macros:state', () => getMacroState())
  ipcMain.handle('macros:play:start', (_event, config: unknown, steps: unknown) => {
    if (!isPlaybackConfig(config)) {
      return { success: false, message: 'Invalid playback settings.' }
    }
    if (!Array.isArray(steps) || !steps.every(isValidMacroStep)) {
      return { success: false, message: 'Invalid macro steps.' }
    }
    return startPlayback(steps, config)
  })
  ipcMain.handle('macros:play:stop', () => stopPlayback())
}
