import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProcessActionResult } from '../shared/types'

const execFileAsync = promisify(execFile)

// Resolves the executable path of a running Windows process by name.
// Returns null when the process is not running.
async function findProcessPath(processName: string): Promise<string | null> {
  const script =
    `Get-Process -Name '${processName}' -ErrorAction SilentlyContinue ` +
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

async function killProcess(processName: string): Promise<void> {
  await execFileAsync('taskkill', ['/IM', `${processName}.exe`, '/F', '/T'])
}

// Starts a process detached from the app so it keeps running on its own.
function startProcess(exePath: string): void {
  const child = spawn(exePath, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function restartProcess(processName: string): Promise<ProcessActionResult> {
  const exePath = await findProcessPath(processName)

  if (exePath === null) {
    return { success: false, message: `${processName} is not running.` }
  }

  try {
    await killProcess(processName)
  } catch (error) {
    return {
      success: false,
      message: `Failed to stop ${processName}: ${errorMessage(error)}`,
    }
  }

  startProcess(exePath)

  return { success: true, message: `${processName} was restarted.` }
}
