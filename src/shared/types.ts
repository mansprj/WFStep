export interface ActionResult {
  success: boolean
  message: string
}

export interface ProcessStatus {
  running: boolean
  path: string | null
  message: string
}
