import { exec } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { shell } from 'electron'
import {
  killProcess,
  killProcessByExe,
  launchProcess,
  restartExe,
  restartProcess,
} from '../processManager'
import type { AutomationAction } from '@shared/actions'
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

async function openFolder(path: string): Promise<ActionResult> {
  const error = await shell.openPath(path)
  if (error.length > 0) {
    return { success: false, message: `Failed to open ${path}: ${error}` }
  }
  return { success: true, message: `Opened ${path}` }
}

export async function executeAction(action: AutomationAction): Promise<ActionResult> {
  switch (action.type) {
    case 'start':
      return launchProcess(action.executablePath)
    case 'stop':
      return isExecutablePath(action.processName)
        ? killProcessByExe(action.processName)
        : killProcess(action.processName)
    case 'restart':
      return isExecutablePath(action.processName)
        ? restartExe(action.processName)
        : restartProcess(action.processName)
    case 'delay':
      await delay(action.ms)
      return { success: true, message: `Delayed for ${action.ms} ms.` }
    case 'shell':
      return runShell(action.command)
    case 'openUrl':
      return openUrl(action.url)
    case 'openFolder':
      return openFolder(action.path)
  }
}
