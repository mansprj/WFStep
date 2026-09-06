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
  ifWindowExists: 'If window is open',
  ifWindowMissing: 'If window is closed',
  ifProcessRunning: 'If process is running',
  ifProcessStopped: 'If process is stopped',
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
  ifWindowExists: 'Window title or program name',
  ifWindowMissing: 'Window title or program name',
  ifProcessRunning: 'Process name (e.g. Discord)',
  ifProcessStopped: 'Process name (e.g. Discord)',
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
  waitForWindow: 'Wait until a window appears.',
  clickText: 'Click an on-screen element by its text (e.g. a button).',
  ifWindowExists: 'Runs the next steps only if the window is open. If the condition fails, skip the given number of next steps.',
  ifWindowMissing: 'Runs the next steps only if the window is closed. If the condition fails, skip the given number of next steps.',
  ifProcessRunning: 'Runs the next steps only if the process is running. If the condition fails, skip the given number of next steps.',
  ifProcessStopped: 'Runs the next steps only if the process is stopped. If the condition fails, skip the given number of next steps.',
}

// Extra knobs shared by the workflow step editor: they only matter for some
// action kinds (conditions, waitForWindow, clickText) but are carried by all
// rows so editing never loses data.
export interface ActionExtras {
  skipOnFail: number
  timeoutMs: number
  window: string
}

export function emptyExtras(): ActionExtras {
  return { skipOnFail: 1, timeoutMs: 10000, window: '' }
}

export function actionFromInput(
  kind: ActionKind,
  value: string,
  extras: ActionExtras = { skipOnFail: 1, timeoutMs: 10000, window: '' },
): AutomationAction {
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
      return { type: 'waitForWindow', window: value, timeoutMs: extras.timeoutMs }
    case 'clickText':
      return {
        type: 'clickText',
        text: value,
        window: extras.window,
        timeoutMs: extras.timeoutMs,
      }
    case 'ifWindowExists':
      return { type: 'ifWindowExists', window: value, skipOnFail: extras.skipOnFail }
    case 'ifWindowMissing':
      return { type: 'ifWindowMissing', window: value, skipOnFail: extras.skipOnFail }
    case 'ifProcessRunning':
      return {
        type: 'ifProcessRunning',
        processName: value,
        skipOnFail: extras.skipOnFail,
      }
    case 'ifProcessStopped':
      return {
        type: 'ifProcessStopped',
        processName: value,
        skipOnFail: extras.skipOnFail,
      }
  }
}

export function inputFromAction(
  action: AutomationAction,
): { kind: ActionKind; value: string; extras: ActionExtras } {
  switch (action.type) {
    case 'start':
      return { kind: 'start', value: action.executablePath, extras: emptyExtras() }
    case 'stop':
      return { kind: 'stop', value: action.processName, extras: emptyExtras() }
    case 'restart':
      return { kind: 'restart', value: action.processName, extras: emptyExtras() }
    case 'delay':
      return { kind: 'delay', value: String(action.ms), extras: emptyExtras() }
    case 'shell':
      return { kind: 'shell', value: action.command, extras: emptyExtras() }
    case 'openUrl':
      return { kind: 'openUrl', value: action.url, extras: emptyExtras() }
    case 'openFolder':
      return { kind: 'openFolder', value: action.path, extras: emptyExtras() }
    case 'activateWindow':
      return { kind: 'activateWindow', value: action.window, extras: emptyExtras() }
    case 'waitForWindow':
      return {
        kind: 'waitForWindow',
        value: action.window,
        extras: { ...emptyExtras(), timeoutMs: action.timeoutMs },
      }
    case 'clickText':
      return {
        kind: 'clickText',
        value: action.text,
        extras: { ...emptyExtras(), window: action.window, timeoutMs: action.timeoutMs },
      }
    case 'ifWindowExists':
      return {
        kind: 'ifWindowExists',
        value: action.window,
        extras: { ...emptyExtras(), skipOnFail: action.skipOnFail },
      }
    case 'ifWindowMissing':
      return {
        kind: 'ifWindowMissing',
        value: action.window,
        extras: { ...emptyExtras(), skipOnFail: action.skipOnFail },
      }
    case 'ifProcessRunning':
      return {
        kind: 'ifProcessRunning',
        value: action.processName,
        extras: { ...emptyExtras(), skipOnFail: action.skipOnFail },
      }
    case 'ifProcessStopped':
      return {
        kind: 'ifProcessStopped',
        value: action.processName,
        extras: { ...emptyExtras(), skipOnFail: action.skipOnFail },
      }
  }
}