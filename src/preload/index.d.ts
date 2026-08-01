import type { AutomationAction } from '@shared/actions'
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
    }
  }
}

export {}
