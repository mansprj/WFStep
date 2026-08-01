import type { ProcessActionResult, ProcessStatus } from '../shared/types'

declare global {
  interface Window {
    api: {
      process: {
        status: (name: string) => Promise<ProcessStatus>
        kill: (name: string) => Promise<ProcessActionResult>
        restart: (name: string) => Promise<ProcessActionResult>
        launch: (path: string) => Promise<ProcessActionResult>
      }
    }
  }
}

export {}
