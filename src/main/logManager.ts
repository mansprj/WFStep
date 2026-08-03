import { app, BrowserWindow } from 'electron'
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { LogEntry, LogSource } from '@shared/logs'

const MAX_ENTRIES = 500

let entries: LogEntry[] = []
let nextId = 1
let loaded = false

function logFilePath(): string {
  return join(app.getPath('userData'), 'logs.jsonl')
}

function load(): void {
  if (loaded) {
    return
  }
  loaded = true
  try {
    if (!existsSync(logFilePath())) {
      return
    }
    const lines = readFileSync(logFilePath(), 'utf8').split('\n')
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue
      }
      try {
        const entry = JSON.parse(line) as LogEntry
        entries.push(entry)
        if (entry.id >= nextId) {
          nextId = entry.id + 1
        }
      } catch {
        // Skip malformed lines.
      }
    }
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES)
    }
  } catch {
    entries = []
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

export function logEvent(input: {
  source: LogSource
  context: string
  actionType: string
  success: boolean
  message: string
}): void {
  load()
  const entry: LogEntry = { id: nextId++, timestamp: new Date().toISOString(), ...input }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES)
  }
  try {
    appendFileSync(logFilePath(), `${JSON.stringify(entry)}\n`)
  } catch {
    // Ignore persistence errors; the log still works in memory.
  }
  broadcast('log:entry', entry)
}

export function listLogs(): LogEntry[] {
  load()
  return [...entries]
}

export function clearLogs(): void {
  entries = []
  loaded = true
  try {
    rmSync(logFilePath(), { force: true })
  } catch {
    // Ignore.
  }
  broadcast('log:cleared', null)
}
