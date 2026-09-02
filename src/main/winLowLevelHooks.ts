import koffi from 'koffi'
import type { MacroButton } from '@shared/macros'

export interface KeyHookInfo {
  vkCode: number
  scanCode: number
  extended: boolean
  injected: boolean
  time: number
}

export interface MouseHookInfo {
  x: number
  y: number
  button: MacroButton | null
  wheelAmount: number // signed wheel notches; 0 when not a wheel event
  injected: boolean
  time: number
}

export interface HooksCallbacks {
  onKeyDown?: (info: KeyHookInfo) => void
  onKeyUp?: (info: KeyHookInfo) => void
  onMouseMove?: (info: MouseHookInfo) => void
  onMouseDown?: (info: MouseHookInfo) => void
  onMouseUp?: (info: MouseHookInfo) => void
  onWheel?: (info: MouseHookInfo) => void
}

const WH_KEYBOARD_LL = 13
const WH_MOUSE_LL = 14

const WM_KEYDOWN = 0x0100
const WM_KEYUP = 0x0101
const WM_SYSKEYDOWN = 0x0104
const WM_SYSKEYUP = 0x0105
const WM_MOUSEMOVE = 0x0200
const WM_LBUTTONDOWN = 0x0201
const WM_LBUTTONUP = 0x0202
const WM_RBUTTONDOWN = 0x0204
const WM_RBUTTONUP = 0x0205
const WM_MBUTTONDOWN = 0x0207
const WM_MBUTTONUP = 0x0208
const WM_MOUSEWHEEL = 0x020a

const LLKHF_EXTENDED = 0x01
const LLKHF_INJECTED = 0x10
const LLMHF_INJECTED = 0x01

const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32',
  scanCode: 'uint32',
  flags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t',
})

const POINT = koffi.struct('POINT', { x: 'int32', y: 'int32' })

const MSLLHOOKSTRUCT = koffi.struct('MSLLHOOKSTRUCT', {
  pt: POINT,
  mouseData: 'uintptr_t',
  flags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t',
})

const HOOKPROC = koffi.proto('__stdcall', 'HOOKPROC', 'intptr_t', [
  'int',
  'uintptr_t',
  'intptr_t',
])
const PHOOKPROC = koffi.pointer('PHOOKPROC', HOOKPROC)

interface HookApi {
  SetWindowsHookExW: (
    idHook: number,
    proc: unknown,
    hmod: unknown,
    dwThreadId: number,
  ) => number | bigint
  UnhookWindowsHookEx: (hhk: number | bigint) => number
  CallNextHookEx: (
    hhk: number | bigint,
    nCode: number,
    wParam: number,
    lParam: number,
  ) => number
}

let api: HookApi | null = null

function hooksApi(): HookApi {
  if (api === null) {
    const lib = koffi.load('user32')
    api = {
      SetWindowsHookExW: lib.func(
        'intptr_t SetWindowsHookExW(int idHook, PHOOKPROC lpfn, void* hmod, unsigned int dwThreadId)',
      ),
      UnhookWindowsHookEx: lib.func(
        'bool UnhookWindowsHookEx(intptr_t hhk)',
      ),
      CallNextHookEx: lib.func(
        'intptr_t CallNextHookEx(intptr_t hhk, int nCode, uintptr_t wParam, intptr_t lParam)',
      ),
    }
  }
  return api
}

let keyHook = 0n
let mouseHook = 0n
let current: WinLowLevelHooks | null = null

function toBigInt(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(value)
}

function deltasToNotches(mouseData: number | bigint): number {
  const data = typeof mouseData === 'bigint' ? mouseData : BigInt(mouseData)
  return Math.round(Number(BigInt.asIntN(16, data >> 16n)) / 120)
}

const onKeyProc = koffi.register(
  (nCode: number, wParam: number, lParam: number): number => {
    try {
      if (nCode >= 0 && current !== null) {
        const info = koffi.decode(lParam, KBDLLHOOKSTRUCT) as {
          vkCode: number
          scanCode: number
          flags: number
          time: number
        }
        const evt: KeyHookInfo = {
          vkCode: info.vkCode,
          scanCode: info.scanCode,
          extended: (info.flags & LLKHF_EXTENDED) !== 0,
          injected: (info.flags & LLKHF_INJECTED) !== 0,
          time: info.time,
        }
        if (wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN) {
          current.callbacks.onKeyDown?.(evt)
        } else if (wParam === WM_KEYUP || wParam === WM_SYSKEYUP) {
          current.callbacks.onKeyUp?.(evt)
        }
      }
    } catch (err) {
      console.error('[winHooks] keyboard callback error:', err)
    }
    const user = hooksApi()
    return user.CallNextHookEx(keyHook, nCode, wParam, lParam)
  },
  PHOOKPROC,
)

const onMouseProc = koffi.register(
  (nCode: number, wParam: number, lParam: number): number => {
    try {
      if (nCode >= 0 && current !== null) {
        const info = koffi.decode(lParam, MSLLHOOKSTRUCT) as {
          pt: { x: number; y: number }
          mouseData: number | bigint
          flags: number
          time: number
        }
        const evt: MouseHookInfo = {
          x: info.pt.x,
          y: info.pt.y,
          button: null,
          wheelAmount: 0,
          injected: (info.flags & LLMHF_INJECTED) !== 0,
          time: info.time,
        }
        switch (wParam) {
          case WM_MOUSEMOVE:
            current.callbacks.onMouseMove?.(evt)
            break
          case WM_LBUTTONDOWN:
            evt.button = 'left'
            current.callbacks.onMouseDown?.(evt)
            break
          case WM_LBUTTONUP:
            evt.button = 'left'
            current.callbacks.onMouseUp?.(evt)
            break
          case WM_RBUTTONDOWN:
            evt.button = 'right'
            current.callbacks.onMouseDown?.(evt)
            break
          case WM_RBUTTONUP:
            evt.button = 'right'
            current.callbacks.onMouseUp?.(evt)
            break
          case WM_MBUTTONDOWN:
            evt.button = 'middle'
            current.callbacks.onMouseDown?.(evt)
            break
          case WM_MBUTTONUP:
            evt.button = 'middle'
            current.callbacks.onMouseUp?.(evt)
            break
          case WM_MOUSEWHEEL:
            evt.wheelAmount = deltasToNotches(info.mouseData)
            current.callbacks.onWheel?.(evt)
            break
        }
      }
    } catch (err) {
      console.error('[winHooks] mouse callback error:', err)
    }
    const user = hooksApi()
    return user.CallNextHookEx(mouseHook, nCode, wParam, lParam)
  },
  PHOOKPROC,
)

function setCurrent(instance: WinLowLevelHooks | null): void {
  current = instance
}

export class WinLowLevelHooks {
  readonly callbacks: HooksCallbacks

  constructor(callbacks: HooksCallbacks) {
    this.callbacks = callbacks
  }

  install(): void {
    if (keyHook !== 0n || mouseHook !== 0n) {
      return
    }
    const user = hooksApi()
    setCurrent(this)
    keyHook = toBigInt(user.SetWindowsHookExW(WH_KEYBOARD_LL, onKeyProc, null, 0))
    mouseHook = toBigInt(user.SetWindowsHookExW(WH_MOUSE_LL, onMouseProc, null, 0))
    if (keyHook === 0n || mouseHook === 0n) {
      this.uninstall()
    }
  }

  uninstall(): void {
    const user = hooksApi()
    if (keyHook !== 0n) {
      user.UnhookWindowsHookEx(keyHook)
      keyHook = 0n
    }
    if (mouseHook !== 0n) {
      user.UnhookWindowsHookEx(mouseHook)
      mouseHook = 0n
    }
    if (current === this) {
      setCurrent(null)
    }
  }
}