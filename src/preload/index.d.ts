import type { AutomationAction } from '@shared/actions'
import type { LogEntry } from '@shared/logs'
import type { ActionResult, ProcessStatus } from '@shared/types'
import type {
  Workflow,
  WorkflowInput,
  WorkflowMutationResult,
  WorkflowProgress,
} from '@shared/workflows'
import type { WindowInfo } from '@shared/windows'

interface WorkflowExportResult {
  success: boolean
  message: string
  path?: string
}

interface WorkflowImportResult {
  success: boolean
  message: string
  input?: WorkflowInput
}

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
      windows: {
        list: () => Promise<WindowInfo[]>
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
        export: (input: WorkflowInput) => Promise<WorkflowExportResult>
        import: () => Promise<WorkflowImportResult>
        onProgress: (
          callback: (progress: WorkflowProgress) => void,
        ) => () => void
      }
      settings: {
        get: () => Promise<{
          autostart: boolean
          theme: string
        }>
        set: (value: Partial<{
          autostart: boolean
          theme: string
        }>) => Promise<{
          autostart: boolean
          theme: string
        }>
      }
      updates: {
        download: () => void
        install: () => void
        onStatus: (callback: (status: string) => void) => () => void
      }
    }
  }
}

export {}
