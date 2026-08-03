import { exec } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { app, shell } from 'electron'
import {
  killProcess,
  killProcessByExe,
  launchProcess,
  restartExe,
  restartProcess,
} from '../processManager'
import { logEvent } from '../logManager'
import type { AutomationAction } from '@shared/actions'
import type { LogSource } from '@shared/logs'
import type { ActionResult } from '@shared/types'

const execAsync = promisify(exec)

const URL_PATTERN = /^https?:\/\//i

// A value containing a path separator is treated as an executable path;
// otherwise it is treated as a process name (as shown in Task Manager).
function isExecutablePath(value: string): boolean {
  return value.includes('\\') || value.includes('/')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runShell(command: string): Promise<ActionResult> {
  try {
    const { stdout, stderr } = await execAsync(command, { windowsHide: true })
    const output = [stdout, stderr]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join('\n')
    return { success: true, message: output.length > 0 ? output : 'Command executed.' }
  } catch (error) {
    return { success: false, message: `Command failed: ${errorMessage(error)}` }
  }
}

async function openUrl(url: string): Promise<ActionResult> {
  if (!URL_PATTERN.test(url)) {
    return { success: false, message: `Only http/https URLs are allowed: ${url}` }
  }
  try {
    await shell.openExternal(url)
    return { success: true, message: `Opened ${url}` }
  } catch (error) {
    return { success: false, message: `Failed to open ${url}: ${errorMessage(error)}` }
  }
}

// Known shell-folder display names (English and Russian) mapped to Electron's
// path keys, so "Рабочий стол" opens the real Desktop folder.
const SPECIAL_FOLDERS: Record<string, Parameters<typeof app.getPath>[0]> = {
  desktop: 'desktop',
  'рабочий стол': 'desktop',
  downloads: 'downloads',
  загрузки: 'downloads',
  documents: 'documents',
  документы: 'documents',
  music: 'music',
  музыка: 'music',
  pictures: 'pictures',
  изображения: 'pictures',
  videos: 'videos',
  видео: 'videos',
  home: 'home',
}

function resolveFolderPath(value: string): string {
  if (value.length === 0 || /[\\/]/.test(value)) {
    return value
  }
  const key = SPECIAL_FOLDERS[value.toLowerCase()]
  if (key === undefined) {
    return value
  }
  try {
    return app.getPath(key)
  } catch {
    return value
  }
}

async function openFolder(input: string): Promise<ActionResult> {
  const path = resolveFolderPath(input.trim())
  const error = await shell.openPath(path)
  if (error.length > 0) {
    return { success: false, message: `Failed to open ${path}: ${error}` }
  }
  return { success: true, message: `Opened ${path}` }
}

export interface ActionRunContext {
  source: LogSource
  context: string
}

export async function executeAction(
  action: AutomationAction,
  runContext?: ActionRunContext,
): Promise<ActionResult> {
  let result: ActionResult
  switch (action.type) {
    case 'start':
      result = await launchProcess(action.executablePath)
      break
    case 'stop':
      result = isExecutablePath(action.processName)
        ? await killProcessByExe(action.processName)
        : await killProcess(action.processName)
      break
    case 'restart':
      result = isExecutablePath(action.processName)
        ? await restartExe(action.processName)
        : await restartProcess(action.processName)
      break
    case 'delay':
      await delay(action.ms)
      result = { success: true, message: `Delayed for ${action.ms} ms.` }
      break
    case 'shell':
      result = await runShell(action.command)
      break
    case 'openUrl':
      result = await openUrl(action.url)
      break
    case 'openFolder':
      result = await openFolder(action.path)
      break
  }
  if (runContext !== undefined) {
    logEvent({
      source: runContext.source,
      context: runContext.context,
      actionType: action.type,
      success: result.success,
      message: result.message,
    })
  }
  return result
}
