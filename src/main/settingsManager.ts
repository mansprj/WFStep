import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Theme = 'graphite-amber' | 'light' | 'blue' | 'system'

export interface Settings {
  autostart: boolean
  theme: Theme
}

const DEFAULTS: Settings = {
  autostart: false,
  theme: 'blue',
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

let cache: Settings | null = null

export function readSettings(): Settings {
  if (cache !== null) return cache
  try {
    if (existsSync(settingsFile())) {
      const raw = JSON.parse(readFileSync(settingsFile(), 'utf-8')) as Record<string, unknown>
      cache = {
        autostart: typeof raw.autostart === 'boolean' ? raw.autostart : DEFAULTS.autostart,
        theme: typeof raw.theme === 'string' && raw.theme.length > 0 ? (raw.theme as Theme) : DEFAULTS.theme,
      }
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
  const updated: Settings = { ...current }
  if (partial.autostart !== undefined) updated.autostart = partial.autostart
  if (partial.theme !== undefined) updated.theme = partial.theme
  writeFileSync(settingsFile(), JSON.stringify(updated, null, 2))
  cache = updated
  return updated
}