export type MacroButton = 'left' | 'right' | 'middle'

export type MacroStep =
  | { type: 'mouseMove'; delayMs: number; x: number; y: number }
  | { type: 'mouseDown'; delayMs: number; x: number; y: number; button: MacroButton }
  | { type: 'mouseUp'; delayMs: number; x: number; y: number; button: MacroButton }
  | { type: 'mouseClick'; delayMs: number; x: number; y: number; button: MacroButton; count: number }
  | { type: 'mouseWheel'; delayMs: number; x: number; y: number; amount: number }
  | { type: 'keyDown'; delayMs: number; key: number }
  | { type: 'keyUp'; delayMs: number; key: number }

export interface Macro {
  id: string
  name: string
  steps: MacroStep[]
  hotkey: string | null
}

export interface MacroInput {
  name: string
  steps: MacroStep[]
  hotkey: string | null
}

export type MacroMutationResult =
  | { success: true; message: string; macro?: Macro }
  | { success: false; message: string }

const BUTTONS: ReadonlyArray<string> = ['left', 'right', 'middle']

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isButton(value: unknown): value is MacroButton {
  return typeof value === 'string' && BUTTONS.includes(value)
}

function isDelay(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

export function isValidMacroStep(value: unknown): value is MacroStep {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (!isDelay(record.delayMs)) {
    return false
  }
  switch (record.type as string) {
    case 'mouseMove':
      return isFiniteNumber(record.x) && isFiniteNumber(record.y)
    case 'mouseDown':
    case 'mouseUp':
      return (
        isFiniteNumber(record.x) &&
        isFiniteNumber(record.y) &&
        isButton(record.button)
      )
    case 'mouseClick':
      return (
        isFiniteNumber(record.x) &&
        isFiniteNumber(record.y) &&
        isButton(record.button) &&
        isFiniteNumber(record.count) &&
        record.count >= 1
      )
    case 'mouseWheel':
      return (
        isFiniteNumber(record.x) &&
        isFiniteNumber(record.y) &&
        isFiniteNumber(record.amount)
      )
    case 'keyDown':
    case 'keyUp':
      return isFiniteNumber(record.key)
    default:
      return false
  }
}

export function isValidMacroInput(value: unknown): value is MacroInput {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return false
  }
  if (!Array.isArray(record.steps)) {
    return false
  }
  if (record.hotkey !== null && typeof record.hotkey !== 'string') {
    return false
  }
  return record.steps.every(isValidMacroStep)
}

export function isValidMacro(value: unknown): value is Macro {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return false
  }
  return isValidMacroInput(record)
}

// Physical-key map for editor display. Keys are Windows scan codes (extended
// keys carry an 0xE000 prefix); unknown codes fall back to a generic label.
const KEY_NAMES: Record<number, string> = {
  1: 'Esc',
  14: 'Backspace',
  15: 'Tab',
  28: 'Enter',
  29: 'Ctrl',
  42: 'Shift',
  54: 'Shift (right)',
  56: 'Alt',
  57: 'Space',
  58: 'CapsLock',
  // Top row digits.
  2: '1',
  3: '2',
  4: '3',
  5: '4',
  6: '5',
  7: '6',
  8: '7',
  9: '8',
  10: '9',
  11: '0',
  // Letters.
  30: 'A',
  48: 'B',
  46: 'C',
  32: 'D',
  18: 'E',
  33: 'F',
  34: 'G',
  35: 'H',
  23: 'I',
  36: 'J',
  37: 'K',
  38: 'L',
  50: 'M',
  49: 'N',
  24: 'O',
  25: 'P',
  16: 'Q',
  19: 'R',
  31: 'S',
  20: 'T',
  22: 'U',
  47: 'V',
  17: 'W',
  45: 'X',
  21: 'Y',
  44: 'Z',
  // Punctuation.
  39: ';',
  13: '=',
  51: ',',
  12: '-',
  52: '.',
  53: '/',
  41: '`',
  26: '[',
  43: '\\',
  27: ']',
  40: "'",
  // Arrows / navigation (extended scancodes carry an 0xE000 prefix).
  57419: '←',
  57416: '↑',
  57421: '→',
  57424: '↓',
  57383: 'Home',
  57417: 'PageUp',
  57425: 'PageDown',
  57423: 'End',
  57426: 'Insert',
  57427: 'Delete',
  // Modifiers (right side, extended).
  57373: 'Ctrl (right)',
  57400: 'Alt (right)',
  57435: 'Meta (Win)',
  57436: 'Meta (Win, right)',
  // Function keys.
  59: 'F1',
  60: 'F2',
  61: 'F3',
  62: 'F4',
  63: 'F5',
  64: 'F6',
  65: 'F7',
  66: 'F8',
  67: 'F9',
  68: 'F10',
  87: 'F11',
  88: 'F12',
  // Numpad.
  82: 'Num0',
  79: 'Num1',
  80: 'Num2',
  81: 'Num3',
  75: 'Num4',
  76: 'Num5',
  77: 'Num6',
  71: 'Num7',
  72: 'Num8',
  73: 'Num9',
  55: 'Num*',
  78: 'Num+',
  74: 'Num-',
  83: 'Num.',
  69: 'NumLock',
  57372: 'NumEnter',
  57429: 'Num/',
}

export function keyName(key: number): string {
  return KEY_NAMES[key] ?? `Key ${key}`
}

export function buttonName(button: MacroButton): string {
  switch (button) {
    case 'left':
      return 'Left'
    case 'right':
      return 'Right'
    case 'middle':
      return 'Middle'
  }
}

export function describeMacroStep(step: MacroStep): string {
  switch (step.type) {
    case 'mouseMove':
      return `Move to ${step.x},${step.y}`
    case 'mouseDown':
      return `${buttonName(step.button)} down at ${step.x},${step.y}`
    case 'mouseUp':
      return `${buttonName(step.button)} up at ${step.x},${step.y}`
    case 'mouseClick':
      return step.count > 1
        ? `${buttonName(step.button)} click ×${step.count} at ${step.x},${step.y}`
        : `${buttonName(step.button)} click at ${step.x},${step.y}`
    case 'mouseWheel':
      return `Scroll ${step.amount > 0 ? 'down' : 'up'} (${Math.abs(step.amount)}) at ${step.x},${step.y}`
    case 'keyDown':
      return `Press ${keyName(step.key)}`
    case 'keyUp':
      return `Release ${keyName(step.key)}`
  }
}

// Total estimated duration (ms) ignoring movement, for the editor footer.
export function macroDurationMs(steps: MacroStep[]): number {
  let total = 0
  for (const step of steps) {
    total += step.delayMs
  }
  return total
}

export type MacroPhase = 'idle' | 'recording' | 'playing'

// Snapshot broadcast to the renderer so it can reflect real-time state.
export interface MacroState {
  phase: MacroPhase
  steps: number
  stepIndex: number
  totalSteps: number
}

export interface PlaybackConfig {
  speed: number
  loop: number // 0 = once, -1 (or any negative) = infinite
}

// Runtime check for playback options arriving over IPC.
export function isPlaybackConfig(value: unknown): value is PlaybackConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.speed !== 'number' || !Number.isFinite(record.speed) || record.speed <= 0) {
    return false
  }
  if (typeof record.loop !== 'number' || !Number.isFinite(record.loop)) {
    return false
  }
  return true
}

