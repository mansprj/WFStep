export type LogSource = 'workflow' | 'action'

export interface LogEntry {
  id: number
  timestamp: string
  source: LogSource
  context: string
  actionType: string
  success: boolean
  message: string
}
