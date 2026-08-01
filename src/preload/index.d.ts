import type { ProcessActionResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      restartDiscord: () => Promise<ProcessActionResult>
    }
  }
}

export {}
