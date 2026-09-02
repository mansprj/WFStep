export type LogSource = 'workflow' | 'action' | 'macro'

export interface LogEntry {
  id: number
  timestamp: string
  source: LogSource
  context: string
  actionType: string
  success: boolean
  message: string
}
