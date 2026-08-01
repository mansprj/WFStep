import type { AutomationAction } from '@shared/actions'
import type { AppEntry, AppInput, AppMutationResult } from '@shared/apps'
import type { ActionResult, ProcessStatus } from '@shared/types'

declare global {
  interface Window {
    api: {
      process: {
        status: (name: string) => Promise<ProcessStatus>
        kill: (name: string) => Promise<ActionResult>
        restart: (name: string) => Promise<ActionResult>
        launch: (path: string) => Promise<ActionResult>
      }
      dialogs: {
        selectExecutable: () => Promise<string | null>
      }
      actions: {
        run: (action: AutomationAction) => Promise<ActionResult>
      }
      apps: {
        list: () => Promise<AppEntry[]>
        add: (input: AppInput) => Promise<AppMutationResult>
        update: (id: string, input: AppInput) => Promise<AppMutationResult>
        remove: (id: string) => Promise<AppMutationResult>
      }
    }
  }
}

export {}
