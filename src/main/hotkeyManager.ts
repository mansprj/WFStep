import { globalShortcut } from 'electron'
import { listWorkflows } from './workflowsManager'
import { startWorkflowRun } from './workflowRunner'

const registered = new Map<string, string>()
const failures = new Map<string, string>()

export function refreshHotkeys(): void {
  globalShortcut.unregisterAll()
  registered.clear()
  failures.clear()

  const taken = new Map<string, string>()
  for (const workflow of listWorkflows()) {
    if (workflow.hotkey === null) {
      continue
    }
    const previous = taken.get(workflow.hotkey)
    if (previous !== undefined) {
      failures.set(
        workflow.id,
        `Hotkey "${workflow.hotkey}" is already used by another workflow.`,
      )
      continue
    }
    taken.set(workflow.hotkey, workflow.id)

    const ok = globalShortcut.register(workflow.hotkey, () => {
      void startWorkflowRun(workflow)
    })
    if (ok) {
      registered.set(workflow.id, workflow.hotkey)
    } else {
      failures.set(
        workflow.id,
        `Hotkey "${workflow.hotkey}" could not be registered (already in use by the system or unsupported on this platform).`,
      )
    }
  }
}

export function hotkeyIssue(workflowId: string): string | null {
  return failures.get(workflowId) ?? null
}

export function registeredHotkeys(): Array<{
  workflowId: string
  accelerator: string
}> {
  return [...registered].map(([workflowId, accelerator]) => ({
    workflowId,
    accelerator,
  }))
}

export function clearHotkeys(): void {
  globalShortcut.unregisterAll()
  registered.clear()
  failures.clear()
}
