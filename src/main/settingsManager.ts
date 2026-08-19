import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Settings {
  autostart: boolean
}

const DEFAULTS: Settings = {
  autostart: false,
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

let cache: Settings | null = null

export function readSettings(): Settings {
  if (cache !== null) return cache
  try {
    if (existsSync(settingsFile())) {
      cache = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile(), 'utf-8')) }
    } else {
      cache = { ...DEFAULTS }
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache as Settings
}

export function writeSettings(partial: Partial<Settings>): Settings {
  const current = readSettings()
  const updated = { ...current, ...partial }
  writeFileSync(settingsFile(), JSON.stringify(updated, null, 2))
  cache = updated
  return updated
}
