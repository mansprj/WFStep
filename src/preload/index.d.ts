import type { AutomationAction } from '@shared/actions'
import type { LogEntry } from '@shared/logs'
import type { ActionResult, ProcessStatus } from '@shared/types'
import type {
  Workflow,
  WorkflowInput,
  WorkflowMutationResult,
  WorkflowProgress,
} from '@shared/workflows'
import type {
  Macro,
  MacroInput,
  MacroMutationResult,
  MacroState,
  MacroStep,
  PlaybackConfig,
} from '@shared/macros'

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
        get: () => Promise<{
          autostart: boolean
          theme: string
          commandHotkeys: {
            record: string | null
            stop: string | null
            discard: string | null
            play: string | null
            stopPlayback: string | null
          }
        }>
        set: (value: Partial<{
          autostart: boolean
          theme: string
          commandHotkeys: Partial<{
            record: string | null
            stop: string | null
            discard: string | null
            play: string | null
            stopPlayback: string | null
          }>
        }>) => Promise<{
          autostart: boolean
          theme: string
          commandHotkeys: {
            record: string | null
            stop: string | null
            discard: string | null
            play: string | null
            stopPlayback: string | null
          }
        }>
      }
      macros: {
        list: () => Promise<Macro[]>
        add: (input: MacroInput) => Promise<MacroMutationResult>
        update: (id: string, input: MacroInput) => Promise<MacroMutationResult>
        remove: (id: string) => Promise<MacroMutationResult>
        recordStart: () => Promise<{ success: boolean; message: string }>
        recordStop: () => Promise<{ success: boolean; message: string }>
        recordDiscard: () => Promise<{ success: boolean; message: string }>
        pendingSteps: () => Promise<MacroStep[]>
        state: () => Promise<MacroState>
        playStart: (config: PlaybackConfig, steps: MacroStep[]) => Promise<{ success: boolean; message: string }>
        playStop: () => Promise<{ success: boolean; message: string }>
        onState: (callback: (state: MacroState) => void) => () => void
        onNotice: (callback: (message: string) => void) => () => void
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
