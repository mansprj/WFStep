import { BrowserWindow } from 'electron'
import { executeAction } from './actions/executor'
import { logEvent } from './logManager'
import { describeAction } from '@shared/actions'
import type { AutomationAction } from '@shared/actions'
import type { Workflow, WorkflowProgress } from '@shared/workflows'

let runningId: string | null = null
let cancelRequested = false

// Returns how many following steps a failed action should skip (only the
// conditional actions carry this). 0 means "stop the workflow on failure".
function actionSkipCount(action: AutomationAction): number {
  switch (action.type) {
    case 'ifWindowExists':
    case 'ifWindowMissing':
    case 'ifProcessRunning':
    case 'ifProcessStopped':
      return action.skipOnFail
    default:
      return 0
  }
}

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
  workflow: Workflow,
): Promise<{ success: boolean; message: string }> {
  if (runningId !== null) {
    return { success: false, message: 'Another workflow is already running.' }
  }

  runningId = workflow.id
  cancelRequested = false

  const send = (payload: WorkflowProgress): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('workflow:progress', payload)
    }
  }
  const progress = (
    stepIndex: number,
    totalSteps: number,
    status: WorkflowProgress['status'],
    message: string,
  ): WorkflowProgress => ({ workflowId: workflow.id, stepIndex, totalSteps, status, message })

  void (async () => {
    const totalSteps = workflow.actions.length
    logEvent({
      source: 'workflow',
      context: workflow.name,
      actionType: 'workflow',
      success: true,
      message: `Workflow started (${totalSteps} step${totalSteps === 1 ? '' : 's'}).`,
    })

    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
      if (cancelRequested) {
        send(progress(stepIndex, totalSteps, 'cancelled', 'Cancelled by user.'))
        logEvent({
          source: 'workflow',
          context: workflow.name,
          actionType: 'workflow',
          success: false,
          message: 'Workflow cancelled by user.',
        })
        break
      }

      const action = workflow.actions[stepIndex]
      send(progress(stepIndex, totalSteps, 'started', describeAction(action)))

      const result = await executeAction(action, {
        source: 'workflow',
        context: workflow.name,
      })
      send(
        progress(
          stepIndex,
          totalSteps,
          result.success ? 'succeeded' : 'failed',
          result.message,
        ),
      )

      if (!result.success) {
        const skip = actionSkipCount(action)
        if (skip > 0) {
          const skippedMessage = `${result.message} Skipping next ${skip} step${skip === 1 ? '' : 's'}.`
          logEvent({
            source: 'workflow',
            context: workflow.name,
            actionType: 'workflow',
            success: false,
            message: `Step ${stepIndex + 1}/${totalSteps}: ${skippedMessage}`,
          })
          stepIndex += skip
          continue
        }
        logEvent({
          source: 'workflow',
          context: workflow.name,
          actionType: 'workflow',
          success: false,
          message: `Workflow stopped at step ${stepIndex + 1}/${totalSteps}: ${result.message}`,
        })
        break
      }
    }

    runningId = null
    send(progress(0, totalSteps, 'done', 'Workflow finished.'))
  })()

  return { success: true, message: `Workflow "${workflow.name}" started.` }
}
