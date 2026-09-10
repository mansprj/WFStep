import { BrowserWindow } from 'electron'
import { executeAction } from './actions/executor'
import { logEvent } from './logManager'
import { resolvePlaceholders } from '@shared/variables'
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

// A copy of the action in which every free-text parameter has its ${name}
// placeholders substituted against the current run variables. Runs in order,
// so a variable is usable in any step after the one that set it.
function withVars(
  action: AutomationAction,
  vars: ReadonlyMap<string, string>,
): AutomationAction {
  const text = (value: string): string => resolvePlaceholders(value, vars)
  switch (action.type) {
    case 'setVariable':
      return { type: 'setVariable', name: action.name, value: text(action.value) }
    case 'start':
      return { type: 'start', executablePath: text(action.executablePath) }
    case 'stop':
      return { type: 'stop', processName: text(action.processName) }
    case 'restart':
      return { type: 'restart', processName: text(action.processName) }
    case 'delay':
      return { type: 'delay', ms: action.ms }
    case 'shell':
      return { type: 'shell', command: text(action.command) }
    case 'openUrl':
      return { type: 'openUrl', url: text(action.url) }
    case 'openFolder':
      return { type: 'openFolder', path: text(action.path) }
    case 'activateWindow':
      return { type: 'activateWindow', window: text(action.window) }
    case 'waitForWindow':
      return {
        type: 'waitForWindow',
        window: text(action.window),
        timeoutMs: action.timeoutMs,
      }
    case 'clickText':
      return {
        type: 'clickText',
        text: text(action.text),
        window: text(action.window),
        timeoutMs: action.timeoutMs,
      }
    case 'ifWindowExists':
      return { type: 'ifWindowExists', window: text(action.window), skipOnFail: action.skipOnFail }
    case 'ifWindowMissing':
      return { type: 'ifWindowMissing', window: text(action.window), skipOnFail: action.skipOnFail }
    case 'ifProcessRunning':
      return {
        type: 'ifProcessRunning',
        processName: text(action.processName),
        skipOnFail: action.skipOnFail,
      }
    case 'ifProcessStopped':
      return {
        type: 'ifProcessStopped',
        processName: text(action.processName),
        skipOnFail: action.skipOnFail,
      }
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
    const vars = new Map<string, string>()
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

      const action = withVars(workflow.actions[stepIndex], vars)
      send(progress(stepIndex, totalSteps, 'started', describeAction(action)))

      // Variable assignment is handled by the run loop itself so later steps
      // can consume the new value.
      if (action.type === 'setVariable') {
        vars.set(action.name, action.value)
        send(
          progress(
            stepIndex,
            totalSteps,
            'succeeded',
            `Variable "${action.name}" set to "${action.value}".`,
          ),
        )
        continue
      }

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
