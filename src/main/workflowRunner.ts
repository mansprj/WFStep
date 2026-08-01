import type { IpcMainInvokeEvent } from 'electron'
import { executeAction } from './actions/executor'
import { describeAction } from '@shared/actions'
import type { Workflow, WorkflowProgress } from '@shared/workflows'

let runningId: string | null = null
let cancelRequested = false

export function isWorkflowRunning(): boolean {
  return runningId !== null
}

export function cancelWorkflowRun(): boolean {
  if (runningId === null) {
    return false
  }
  cancelRequested = true
  return true
}

export async function startWorkflowRun(
  event: IpcMainInvokeEvent,
  workflow: Workflow,
): Promise<{ success: boolean; message: string }> {
  if (runningId !== null) {
    return { success: false, message: 'Another workflow is already running.' }
  }

  runningId = workflow.id
  cancelRequested = false

  const send = (payload: WorkflowProgress): void => {
    event.sender.send('workflow:progress', payload)
  }
  const progress = (
    stepIndex: number,
    totalSteps: number,
    status: WorkflowProgress['status'],
    message: string,
  ): WorkflowProgress => ({ workflowId: workflow.id, stepIndex, totalSteps, status, message })

  void (async () => {
    const totalSteps = workflow.actions.length

    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
      if (cancelRequested) {
        send(progress(stepIndex, totalSteps, 'cancelled', 'Cancelled by user.'))
        break
      }

      const action = workflow.actions[stepIndex]
      send(progress(stepIndex, totalSteps, 'started', describeAction(action)))

      const result = await executeAction(action)
      send(
        progress(
          stepIndex,
          totalSteps,
          result.success ? 'succeeded' : 'failed',
          result.message,
        ),
      )

      if (!result.success) {
        break
      }
    }

    runningId = null
    send(progress(0, totalSteps, 'done', 'Workflow finished.'))
  })()

  return { success: true, message: `Workflow "${workflow.name}" started.` }
}
