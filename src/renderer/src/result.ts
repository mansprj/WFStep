export type Result =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'info'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
