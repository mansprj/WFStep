export type AutomationAction =
  | { type: 'start'; executablePath: string }
  | { type: 'stop'; processName: string }
  | { type: 'restart'; processName: string }
  | { type: 'delay'; ms: number }
  | { type: 'shell'; command: string }
  | { type: 'openUrl'; url: string }
  | { type: 'openFolder'; path: string }
  | { type: 'activateWindow'; window: string }
  | { type: 'waitForWindow'; window: string; timeoutMs: number }
  | { type: 'clickText'; text: string; window: string; timeoutMs: number }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// Runtime check for values arriving over IPC (the renderer is not trusted).
export function isAutomationAction(value: unknown): value is AutomationAction {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  switch (record.type as string) {
    case 'start':
      return isNonEmptyString(record.executablePath)
    case 'stop':
    case 'restart':
      return isNonEmptyString(record.processName)
    case 'delay':
      return (
        typeof record.ms === 'number' &&
        Number.isFinite(record.ms) &&
        record.ms >= 0
      )
    case 'shell':
      return isNonEmptyString(record.command)
    case 'openUrl':
      return isNonEmptyString(record.url)
    case 'openFolder':
      return isNonEmptyString(record.path)
    case 'activateWindow':
      return isNonEmptyString(record.window)
    case 'waitForWindow':
      return (
        isNonEmptyString(record.window) &&
        typeof record.timeoutMs === 'number' &&
        Number.isFinite(record.timeoutMs) &&
        record.timeoutMs >= 0
      )
    case 'clickText':
      return (
        isNonEmptyString(record.text) &&
        typeof record.window === 'string' &&
        typeof record.timeoutMs === 'number' &&
        Number.isFinite(record.timeoutMs) &&
        record.timeoutMs >= 0
      )
    default:
      return false
  }
}

// Short human-readable description used in workflow progress and step lists.
export function describeAction(action: AutomationAction): string {
  switch (action.type) {
    case 'start':
      return `Start process: ${action.executablePath}`
    case 'stop':
      return `Stop process: ${action.processName}`
    case 'restart':
      return `Restart process: ${action.processName}`
    case 'delay':
      return `Delay ${action.ms} ms`
    case 'shell':
      return `Shell command: ${action.command}`
    case 'openUrl':
      return `Open URL: ${action.url}`
    case 'openFolder':
      return `Open folder: ${action.path}`
    case 'activateWindow':
      return `Activate window: ${action.window}`
    case 'waitForWindow':
      return `Wait for window: ${action.window}`
    case 'clickText':
      return `Click "${action.text}"`
  }
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

// Compact label for lists: keeps the key detail, drops the full path.
export function describeActionShort(action: AutomationAction): string {
  switch (action.type) {
    case 'start':
      return `Start ${baseName(action.executablePath)}`
    case 'stop':
      return `Stop ${baseName(action.processName)}`
    case 'restart':
      return `Restart ${baseName(action.processName)}`
    case 'delay':
      return `Wait ${action.ms} ms`
    case 'shell':
      return `Run ${action.command}`
    case 'openUrl':
      return `Open ${action.url}`
    case 'openFolder':
      return `Open ${baseName(action.path)}`
    case 'activateWindow':
      return `Focus ${action.window}`
    case 'waitForWindow':
      return `Wait ${action.window}`
    case 'clickText':
      return `Click ${action.text}`
  }
}
