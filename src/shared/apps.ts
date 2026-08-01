export interface AppEntry {
  id: string
  name: string
  executablePath: string | null
  processName: string | null
}

export interface AppInput {
  name: string
  executablePath: string | null
  processName: string | null
}

export type AppMutationResult =
  | { success: true; message: string; app?: AppEntry }
  | { success: false; message: string }

// Runtime checks for values arriving over IPC (the renderer is not trusted).
export function isValidAppInput(value: unknown): value is AppInput {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return false
  }

  const executablePath = record.executablePath
  const processName = record.processName

  if (executablePath !== null && typeof executablePath !== 'string') {
    return false
  }
  if (processName !== null && typeof processName !== 'string') {
    return false
  }
  if (typeof executablePath !== 'string' && typeof processName !== 'string') {
    return false
  }
  if (typeof executablePath === 'string' && executablePath.trim().length === 0) {
    return false
  }
  if (typeof processName === 'string' && processName.trim().length === 0) {
    return false
  }

  return true
}

export function isAppEntry(value: unknown): value is AppEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return false
  }
  return isValidAppInput(record)
}
