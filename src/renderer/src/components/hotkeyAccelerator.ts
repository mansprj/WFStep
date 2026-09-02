const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

// Builds an Electron accelerator from the physical key (event.code), so the
// combination works regardless of the keyboard layout (e.g. Cyrillic).
export function codeToAccelerator(event: React.KeyboardEvent): string | null {
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0) {
    return null
  }

  const code = event.code
  if (/^(Control|Alt|Shift|Meta)(Left|Right)$/.test(code)) {
    return null
  }

  const letter = /^Key([A-Z])$/.exec(code)?.[1]
  if (letter !== undefined) {
    return [...modifiers, letter].join('+')
  }
  const digit = /^Digit([0-9])$/.exec(code)?.[1]
  if (digit !== undefined) {
    return [...modifiers, digit].join('+')
  }
  const numpad = /^Numpad([0-9])$/.exec(code)?.[1]
  if (numpad !== undefined) {
    return [...modifiers, `num${numpad}`].join('+')
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) {
    return [...modifiers, code].join('+')
  }

  const mapped = NAMED_KEYS[code]
  return mapped === undefined ? null : [...modifiers, mapped].join('+')
}
