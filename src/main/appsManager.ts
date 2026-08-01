import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { isAppEntry, isValidAppInput } from '@shared/apps'
import type { AppEntry, AppInput, AppMutationResult } from '@shared/apps'
import { PROCESS_NAME_PATTERN } from './processManager'

function storeFile(): string {
  return join(app.getPath('userData'), 'apps.json')
}

let cache: AppEntry[] | null = null

function readApps(): AppEntry[] {
  if (cache !== null) {
    return cache
  }
  const file = storeFile()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    cache = Array.isArray(raw) ? raw.filter(isAppEntry) : []
  } catch {
    cache = []
  }
  return cache
}

function writeApps(apps: AppEntry[]): void {
  const file = storeFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(apps, null, 2))
  cache = apps
}

// Normalizes a validated input: trims fields, drops empty ones and a trailing
// .exe on the process name (Windows strips it in process names).
function sanitizeInput(value: unknown): AppInput | null {
  if (!isValidAppInput(value)) {
    return null
  }

  const name = value.name.trim()

  let executablePath: string | null = value.executablePath?.trim() ?? null
  if (executablePath !== null && executablePath.length === 0) {
    executablePath = null
  }

  let processName: string | null = value.processName?.trim() ?? null
  if (processName !== null) {
    if (processName.toLowerCase().endsWith('.exe')) {
      processName = processName.slice(0, -4).trim()
    }
    if (processName.length === 0) {
      processName = null
    }
  }

  if (executablePath === null && processName === null) {
    return null
  }
  if (processName !== null && !PROCESS_NAME_PATTERN.test(processName)) {
    return null
  }

  return { name, executablePath, processName }
}

export function listApps(): AppEntry[] {
  return readApps()
}

export function addApp(value: unknown): AppMutationResult {
  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid application data.' }
  }

  const apps = readApps()
  if (apps.some((app) => app.name.toLowerCase() === input.name.toLowerCase())) {
    return {
      success: false,
      message: `Application "${input.name}" already exists.`,
    }
  }

  const entry: AppEntry = { id: randomUUID(), ...input }
  writeApps([...apps, entry])
  return { success: true, message: `Added ${entry.name}.`, app: entry }
}

export function updateApp(id: unknown, value: unknown): AppMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid application id.' }
  }

  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid application data.' }
  }

  const apps = readApps()
  const index = apps.findIndex((app) => app.id === id)
  if (index === -1) {
    return { success: false, message: 'Application not found.' }
  }

  const duplicate = apps.find(
    (app) => app.id !== id && app.name.toLowerCase() === input.name.toLowerCase(),
  )
  if (duplicate !== undefined) {
    return {
      success: false,
      message: `Application "${input.name}" already exists.`,
    }
  }

  const updated: AppEntry = { ...apps[index], ...input }
  apps[index] = updated
  writeApps(apps)
  return { success: true, message: `Updated ${updated.name}.`, app: updated }
}

export function removeApp(id: unknown): AppMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid application id.' }
  }

  const apps = readApps()
  const entry = apps.find((app) => app.id === id)
  if (entry === undefined) {
    return { success: false, message: 'Application not found.' }
  }

  writeApps(apps.filter((app) => app.id !== id))
  return { success: true, message: `Removed ${entry.name}.` }
}
