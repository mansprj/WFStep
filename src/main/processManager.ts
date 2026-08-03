import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { promisify } from 'node:util'
import type { ActionResult, ProcessStatus } from '@shared/types'

const execFileAsync = promisify(execFile)

// Windows process names are limited to these characters.
export const PROCESS_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/

function invalidNameResult(value: unknown): ActionResult | null {
  if (typeof value !== 'string' || !PROCESS_NAME_PATTERN.test(value)) {
    return { success: false, message: `Invalid process name: ${String(value)}` }
  }
  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Resolves the executable path of a running Windows process by name.
// Returns null when the process is not running.
export async function findProcessPath(processName: string): Promise<string | null> {
  const escapedName = processName.replace(/'/g, "''")
  const script =
    `Get-Process -Name '${escapedName}' -ErrorAction SilentlyContinue ` +
    `| Select-Object -First 1 -ExpandProperty Path`

  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ])
    const path = stdout.trim().split(/\r?\n/)[0]?.trim()
    return path.length > 0 ? path : null
  } catch {
    return null
  }
}

export async function getProcessStatus(processName: string): Promise<ProcessStatus> {
  const invalid = invalidNameResult(processName)
  if (invalid !== null) {
    return { running: false, path: null, message: invalid.message }
  }

  const path = await findProcessPath(processName)
  if (path === null) {
    return { running: false, path: null, message: `${processName} is not running.` }
  }
  return { running: true, path, message: `${processName} is running.` }
}

export async function killProcess(processName: string): Promise<ActionResult> {
  const invalid = invalidNameResult(processName)
  if (invalid !== null) {
    return invalid
  }

  try {
    await execFileAsync('taskkill', ['/IM', `${processName}.exe`, '/F', '/T'])
    return { success: true, message: `${processName} was stopped.` }
  } catch (error) {
    return {
      success: false,
      message: `Failed to stop ${processName}: ${errorMessage(error)}`,
    }
  }
}

export async function launchProcess(exePath: string): Promise<ActionResult> {
  const path = exePath.trim()
  if (path.length === 0) {
    return { success: false, message: 'Executable path is empty.' }
  }
  if (!existsSync(path)) {
    return { success: false, message: `File not found: ${path}` }
  }
  if (statSync(path).isDirectory()) {
    return {
      success: false,
      message: `${path} is a directory. Specify an executable file.`,
    }
  }

  return new Promise((resolve) => {
    const child = spawn(path, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('spawn', () => {
      child.unref()
      resolve({ success: true, message: `Started: ${path}` })
    })
    child.once('error', (error) => {
      resolve({ success: false, message: `Failed to start ${path}: ${error.message}` })
    })
  })
}

export async function restartProcess(processName: string): Promise<ActionResult> {
  const invalid = invalidNameResult(processName)
  if (invalid !== null) {
    return invalid
  }

  const exePath = await findProcessPath(processName)
  if (exePath === null) {
    return { success: false, message: `${processName} is not running.` }
  }

  const killResult = await killProcess(processName)
  if (!killResult.success) {
    return killResult
  }

  const launchResult = await launchProcess(exePath)
  if (!launchResult.success) {
    return launchResult
  }

  return { success: true, message: `${processName} was restarted.` }
}

// Kills every running instance of the executable by its image name, so the
// restart/stop of a saved app does not depend on a hand-typed process name.
export async function killProcessByExe(exePath: string): Promise<ActionResult> {
  const path = exePath.trim()
  if (path.length === 0) {
    return { success: false, message: 'Executable path is empty.' }
  }
  if (!existsSync(path)) {
    return { success: false, message: `File not found: ${path}` }
  }

  const imageName = basename(path)
  try {
    await execFileAsync('taskkill', ['/IM', imageName, '/F', '/T'])
    return { success: true, message: `${imageName} was stopped.` }
  } catch (error) {
    const message = errorMessage(error).toLowerCase()
    if (message.includes('not found')) {
      return { success: true, message: `${imageName} is not running.` }
    }
    return {
      success: false,
      message: `Failed to stop ${imageName}: ${errorMessage(error)}`,
    }
  }
}

// Restarts an app by its executable path: kills any running instance (if any)
// and launches the executable again.
export async function restartExe(exePath: string): Promise<ActionResult> {
  const path = exePath.trim()
  if (path.length === 0) {
    return { success: false, message: 'Executable path is empty.' }
  }
  if (!existsSync(path)) {
    return { success: false, message: `File not found: ${path}` }
  }
  if (statSync(path).isDirectory()) {
    return {
      success: false,
      message: `${path} is a directory. Specify an executable file.`,
    }
  }

  const imageName = basename(path)
  try {
    await execFileAsync('taskkill', ['/IM', imageName, '/F', '/T'])
  } catch (error) {
    const message = errorMessage(error).toLowerCase()
    if (!message.includes('not found')) {
      return {
        success: false,
        message: `Failed to stop ${imageName}: ${errorMessage(error)}`,
      }
    }
  }

  const launchResult = await launchProcess(path)
  if (!launchResult.success) {
    return launchResult
  }

  return { success: true, message: `${imageName} was restarted.` }
}
