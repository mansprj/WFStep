import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Theme = 'graphite-amber' | 'light' | 'blue' | 'system'

export type CommandKey =
  | 'record'
  | 'stop'
  | 'discard'
  | 'play'
  | 'stopPlayback'

export type CommandHotkeys = Record<CommandKey, string | null>

export interface Settings {
  autostart: boolean
  theme: Theme
  commandHotkeys: CommandHotkeys
}

const DEFAULT_HOTKEYS: CommandHotkeys = {
  record: null,
  stop: 'F9',
  discard: 'Ctrl+Shift+D',
  play: null,
  stopPlayback: null,
}

const DEFAULTS: Settings = {
  autostart: false,
  theme: 'blue',
  commandHotkeys: { ...DEFAULT_HOTKEYS },
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

const COMMAND_KEYS: CommandKey[] = ['record', 'stop', 'discard', 'play', 'stopPlayback']

function sanitizeCommandHotkeys(value: unknown): CommandHotkeys {
  const input = (typeof value === 'object' && value !== null
    ? value
    : {}) as Record<string, unknown>
  const out = { ...DEFAULT_HOTKEYS }
  for (const key of COMMAND_KEYS) {
    const v = input[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      out[key] = v
    } else {
      out[key] = null
    }
  }
  return out
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
        commandHotkeys: sanitizeCommandHotkeys(raw.commandHotkeys),
      }
    } else {
      cache = { ...DEFAULTS, commandHotkeys: { ...DEFAULT_HOTKEYS } }
    }
  } catch {
    cache = { ...DEFAULTS, commandHotkeys: { ...DEFAULT_HOTKEYS } }
  }
  return cache as Settings
}

export function writeSettings(partial: Partial<Settings>): Settings {
  const current = readSettings()
  const updated: Settings = { ...current }
  if (partial.autostart !== undefined) updated.autostart = partial.autostart
  if (partial.theme !== undefined) updated.theme = partial.theme
  if (partial.commandHotkeys !== undefined) {
    updated.commandHotkeys = sanitizeCommandHotkeys({
      ...current.commandHotkeys,
      ...partial.commandHotkeys,
    })
  }
  writeFileSync(settingsFile(), JSON.stringify(updated, null, 2))
  cache = updated
  return updated
}
