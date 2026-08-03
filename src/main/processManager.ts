import { execFile, execFileSync, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { TextDecoder } from 'node:util'
import { promisify } from 'node:util'
import type { ActionResult, ProcessStatus } from '@shared/types'

const execFileAsync = promisify(execFile)

// Windows process names are limited to these characters.
export const PROCESS_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/

// Windows console tools (taskkill, tasklist, …) write localized messages in
// the OEM codepage (e.g. cp866 for Russian). Node decodes them as UTF-8,
// producing mojibake, so we decode with the system's OEM codepage instead.
let oemDecoder: TextDecoder | null = null

function getOemDecoder(): TextDecoder {
  if (oemDecoder === null) {
    let label = 'utf8'
    try {
      const out = execFileSync('cmd', ['/d', '/c', 'chcp'], {
        encoding: 'utf8',
        windowsHide: true,
      })
      const code = /(\d+)/.exec(out)?.[1]
      if (code === '866') {
        label = 'ibm866'
      } else if (code === '437' || code === '850' || code === '852' || code === '858') {
        label = 'iso-8859-1'
      }
    } catch {
      // Keep UTF-8.
    }
    oemDecoder = new TextDecoder(label)
  }
  return oemDecoder
}

function decodeConsoleOutput(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'latin1') : value
  try {
    return getOemDecoder().decode(buffer)
  } catch {
    return buffer.toString('utf8')
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && typeof (error as { stderr?: unknown }).stderr === 'object') {
    const stderr = (error as { stderr?: Buffer | string }).stderr
    if (stderr !== undefined && (Buffer.isBuffer(stderr) || typeof stderr === 'string')) {
      const decoded = decodeConsoleOutput(stderr)
      if (decoded.trim().length > 0) {
        return decoded.trim()
      }
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function invalidNameResult(value: unknown): ActionResult | null {
  if (typeof value !== 'string' || !PROCESS_NAME_PATTERN.test(value)) {
    return { success: false, message: `Invalid process name: ${String(value)}` }
  }
  return null
}

// Whether any process with the given image name (e.g. "Discord.exe") is
// running. Uses tasklist so the check is locale-independent.
async function isImageRunning(imageName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FI', `IMAGENAME eq ${imageName}`, '/NH'],
      { encoding: 'utf8', windowsHide: true },
    )
    return stdout.toLowerCase().includes(imageName.toLowerCase())
  } catch {
    // If we cannot check, assume the process is still running so a real
    // failure is reported instead of a false "already stopped".
    return true
  }
}

// Kills every instance of an image by name. A missing process is reported as
// success ("already stopped") so repeated stop steps don't fail a workflow.
async function stopByImageName(imageName: string, label: string): Promise<ActionResult> {
  try {
    await execFileAsync('taskkill', ['/IM', imageName, '/F', '/T'], {
      encoding: 'buffer',
      windowsHide: true,
    })
    return { success: true, message: `${label} was stopped.` }
  } catch (error) {
    if (await isImageRunning(imageName)) {
      return {
        success: false,
        message: `Failed to stop ${label}: ${errorMessage(error)}`,
      }
    }
    return { success: true, message: `${label} is not running.` }
  }
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

  return stopByImageName(`${processName}.exe`, processName)
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
  return stopByImageName(imageName, imageName)
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
  const killResult = await stopByImageName(imageName, imageName)
  if (!killResult.success) {
    return killResult
  }

  const launchResult = await launchProcess(path)
  if (!launchResult.success) {
    return launchResult
  }

  return { success: true, message: `${imageName} was restarted.` }
}
