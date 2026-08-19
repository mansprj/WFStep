import type { AutomationAction } from '@shared/actions'
import type { LogEntry } from '@shared/logs'
import type { ActionResult, ProcessStatus } from '@shared/types'
import type {
  Workflow,
  WorkflowInput,
  WorkflowMutationResult,
  WorkflowProgress,
} from '@shared/workflows'

declare global {
  interface Window {
    api: {
      process: {
        status: (name: string) => Promise<ProcessStatus>
        kill: (name: string) => Promise<ActionResult>
        restart: (name: string) => Promise<ActionResult>
        killByPath: (path: string) => Promise<ActionResult>
        restartByPath: (path: string) => Promise<ActionResult>
        launch: (path: string) => Promise<ActionResult>
      }
      dialogs: {
        selectExecutable: () => Promise<string | null>
        selectImage: () => Promise<string | null>
        selectFolder: () => Promise<string | null>
      }
      icons: {
        get: (path: string) => Promise<string | null>
      }
      favicons: {
        get: (url: string) => Promise<string | null>
      }
      pages: {
        title: (url: string) => Promise<string | null>
      }
      actions: {
        run: (action: AutomationAction) => Promise<ActionResult>
      }
      logs: {
        list: () => Promise<LogEntry[]>
        clear: () => Promise<{ success: boolean; message: string }>
        onEntry: (callback: (entry: LogEntry) => void) => () => void
        onCleared: (callback: () => void) => () => void
      }
      workflows: {
        list: () => Promise<Workflow[]>
        add: (input: WorkflowInput) => Promise<WorkflowMutationResult>
        update: (id: string, input: WorkflowInput) => Promise<WorkflowMutationResult>
        remove: (id: string) => Promise<WorkflowMutationResult>
        run: (id: string) => Promise<{ success: boolean; message: string }>
        cancel: () => Promise<{ success: boolean; message: string }>
        onProgress: (
          callback: (progress: WorkflowProgress) => void,
        ) => () => void
      }
      settings: {
        get: () => Promise<{ autostart: boolean }>
        set: (value: Partial<{ autostart: boolean }>) => Promise<{ autostart: boolean }>
      }
    }
  }
}

export {}
