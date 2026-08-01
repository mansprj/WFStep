export type AutomationAction =
  | { type: 'start'; executablePath: string }
  | { type: 'stop'; processName: string }
  | { type: 'restart'; processName: string }
  | { type: 'delay'; ms: number }
  | { type: 'shell'; command: string }
  | { type: 'openUrl'; url: string }
  | { type: 'openFolder'; path: string }

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
  }
}
