import type { AutomationAction } from '@shared/actions'

export type ActionKind = AutomationAction['type']

export const KIND_LABELS: Record<ActionKind, string> = {
  start: 'Start process',
  stop: 'Stop process',
  restart: 'Restart process',
  delay: 'Delay',
  shell: 'Run shell command',
  openUrl: 'Open URL',
  openFolder: 'Open folder',
  activateWindow: 'Activate window',
  waitForWindow: 'Wait for window',
  clickText: 'Click element by text',
}

export const KIND_PLACEHOLDERS: Record<ActionKind, string> = {
  start: 'C:\\Path\\To\\App.exe',
  stop: 'Executable path or process name (e.g. Discord)',
  restart: 'Executable path or process name (e.g. Discord)',
  delay: 'Milliseconds (e.g. 2000)',
  shell: 'Command (e.g. echo hello)',
  openUrl: 'https://example.com',
  openFolder: 'C:\\Path\\To\\Folder',
  activateWindow: 'Window title or program name (e.g. Chrome)',
  waitForWindow: 'Window title or program name (e.g. Chrome)',
  clickText: 'Element text to click (e.g. OK, Save)',
}

export const KIND_HELP: Record<ActionKind, string> = {
  start: 'Launch an executable file.',
  stop: 'Stop a running program by executable path or process name.',
  restart: 'Restart a running program by executable path or process name.',
  delay: 'Wait the given number of milliseconds.',
  shell: 'Run a shell command.',
  openUrl: 'Open a web address (http/https only).',
  openFolder: 'Open a folder in Explorer.',
  activateWindow: 'Bring a window to the foreground by its title or program name.',
  waitForWindow: 'Wait until a window appears (default 10 s).',
  clickText: 'Click an on-screen element by its text (e.g. a button).',
}

export function actionFromInput(kind: ActionKind, value: string): AutomationAction {
  switch (kind) {
    case 'start':
      return { type: 'start', executablePath: value }
    case 'stop':
      return { type: 'stop', processName: value }
    case 'restart':
      return { type: 'restart', processName: value }
    case 'delay':
      return { type: 'delay', ms: Number(value) }
    case 'shell':
      return { type: 'shell', command: value }
    case 'openUrl':
      return { type: 'openUrl', url: value }
    case 'openFolder':
      return { type: 'openFolder', path: value }
    case 'activateWindow':
      return { type: 'activateWindow', window: value }
    case 'waitForWindow':
      return { type: 'waitForWindow', window: value, timeoutMs: 10000 }
    case 'clickText':
      return { type: 'clickText', text: value, window: '', timeoutMs: 5000 }
  }
}

export function inputFromAction(
  action: AutomationAction,
): { kind: ActionKind; value: string } {
  switch (action.type) {
    case 'start':
      return { kind: 'start', value: action.executablePath }
    case 'stop':
      return { kind: 'stop', value: action.processName }
    case 'restart':
      return { kind: 'restart', value: action.processName }
    case 'delay':
      return { kind: 'delay', value: String(action.ms) }
    case 'shell':
      return { kind: 'shell', value: action.command }
    case 'openUrl':
      return { kind: 'openUrl', value: action.url }
    case 'openFolder':
      return { kind: 'openFolder', value: action.path }
    case 'activateWindow':
      return { kind: 'activateWindow', value: action.window }
    case 'waitForWindow':
      return { kind: 'waitForWindow', value: action.window }
    case 'clickText':
      return { kind: 'clickText', value: action.text }
  }
}
