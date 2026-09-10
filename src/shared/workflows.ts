import { describeAction, isAutomationAction } from './actions'
import type { AutomationAction } from './actions'
import { isValidWorkflowSchedule } from './schedules'
import type { WorkflowSchedule } from './schedules'

export interface Workflow {
  id: string
  name: string
  actions: AutomationAction[]
  iconPath: string | null
  hotkey: string | null
  schedules: WorkflowSchedule[]
}

export interface WorkflowInput {
  name: string
  actions: AutomationAction[]
  iconPath: string | null
  hotkey: string | null
  schedules: WorkflowSchedule[]
}

export type WorkflowMutationResult =
  | { success: true; message: string; workflow?: Workflow }
  | { success: false; message: string }

export type WorkflowProgressStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'done'

export interface WorkflowProgress {
  workflowId: string
  stepIndex: number
  totalSteps: number
  status: WorkflowProgressStatus
  message: string
}

// Runtime checks for values arriving over IPC (the renderer is not trusted).
export function isValidWorkflowInput(value: unknown): value is WorkflowInput {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return false
  }
  if (!Array.isArray(record.actions)) {
    return false
  }
  if (record.iconPath !== null && typeof record.iconPath !== 'string') {
    return false
  }
  if (record.hotkey !== null && typeof record.hotkey !== 'string') {
    return false
  }
  // Missing `schedules` (older saved workflows) means "no schedule".
  if (
    record.schedules !== undefined &&
    (!Array.isArray(record.schedules) ||
      !record.schedules.every(isValidWorkflowSchedule))
  ) {
    return false
  }
  return record.actions.every(isAutomationAction)
}

export function isValidWorkflow(value: unknown): value is Workflow {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return false
  }
  return isValidWorkflowInput(record)
}

export function workflowStepLabel(action: AutomationAction): string {
  return describeAction(action)
}
