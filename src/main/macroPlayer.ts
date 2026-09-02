import koffi from 'koffi'
import type { MacroButton, MacroStep } from '@shared/macros'

// Windows user32 INPUT type constants.
const INPUT_MOUSE = 0
const INPUT_KEYBOARD = 1

const MOUSEEVENTF_MOVE = 0x0001
const MOUSEEVENTF_LEFTDOWN = 0x0002
const MOUSEEVENTF_LEFTUP = 0x0004
const MOUSEEVENTF_RIGHTDOWN = 0x0008
const MOUSEEVENTF_RIGHTUP = 0x0010
const MOUSEEVENTF_MIDDLEDOWN = 0x0020
const MOUSEEVENTF_MIDDLEUP = 0x0040
const MOUSEEVENTF_WHEEL = 0x0800
const MOUSEEVENTF_ABSOLUTE = 0x8000

const KEYEVENTF_KEYUP = 0x0002
const KEYEVENTF_SCANCODE = 0x0008
const KEYEVENTF_EXTENDEDKEY = 0x0001

const SM_CXSCREEN = 0
const SM_CYSCREEN = 1
const WHEEL_DELTA = 120

// koffi type descriptors (module-level so they are created once).
const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
  dx: 'long',
  dy: 'long',
  mouseData: 'uint32',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t',
})
const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16',
  wScan: 'uint16',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t',
})
const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
  uMsg: 'uint32',
  wParamL: 'uint16',
  wParamH: 'uint16',
})
const INPUT_UNION = koffi.union('INPUT_UNION', {
  mi: MOUSEINPUT,
  ki: KEYBDINPUT,
  hi: HARDWAREINPUT,
})
const INPUT = koffi.struct('INPUT', { type: 'uint32', u: INPUT_UNION })

let user32: ReturnType<typeof koffi.load> | null = null

interface User32 {
  SendInput: (count: number, inputs: unknown[], size: number) => number
  GetSystemMetrics: (index: number) => number
}

function lib(): ReturnType<typeof koffi.load> {
  if (user32 === null) {
    user32 = koffi.load('user32')
  }
  return user32
}

let api: User32 | null = null
let screenW = 0
let screenH = 0

function ensureApi(): User32 {
  if (api === null) {
    const handle = lib()
    api = {
      SendInput: handle.func(
        'uint32 __stdcall SendInput(uint32 cInputs, INPUT *inputs, int32 cbSize)',
      ),
      GetSystemMetrics: handle.func('int32 __stdcall GetSystemMetrics(int32 index)'),
    }
    screenW = Math.max(1, api.GetSystemMetrics(SM_CXSCREEN))
    screenH = Math.max(1, api.GetSystemMetrics(SM_CYSCREEN))
  }
  return api
}

function mouseInput(flags: number, data = 0, x = 0, y = 0): unknown {
  return {
    type: INPUT_MOUSE,
    u: {
      mi: {
        dx: x,
        dy: y,
        mouseData: data,
        dwFlags: flags,
        time: 0,
        dwExtraInfo: 0n,
      },
    },
  }
}

function buttonFlagsDown(button: MacroButton): number {
  switch (button) {
    case 'left':
      return MOUSEEVENTF_LEFTDOWN
    case 'right':
      return MOUSEEVENTF_RIGHTDOWN
    case 'middle':
      return MOUSEEVENTF_MIDDLEDOWN
  }
}

function buttonFlagsUp(button: MacroButton): number {
  switch (button) {
    case 'left':
      return MOUSEEVENTF_LEFTUP
    case 'right':
      return MOUSEEVENTF_RIGHTUP
    case 'middle':
      return MOUSEEVENTF_MIDDLEUP
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A key is "extended" when its scancode carries the E0 prefix (0xE0xx), which is
// true for arrows, Home/End, PageUp/PageDown, Insert/Delete, numpad enter, etc.
function isExtended(scancode: number): boolean {
  return scancode > 0xff
}

function sendRaw(api: User32, input: unknown): void {
  api.SendInput(1, [input], INPUT.size)
}

export interface PlaybackOptions {
  speed: number
  loop: number // 0 = run once; negative = infinite
}

export class MacroPlayer {
  private playing = false
  private stopRequested = false

  get isPlaying(): boolean {
    return this.playing
  }

  private sendKey(scancode: number, down: boolean): void {
    const user = ensureApi()
    const ext = isExtended(scancode)
    // Inject by scancode so playback is independent of the keyboard layout and
    // so system-modifier combinations (Win, Alt, Tab…) are delivered properly.
    const flags =
      KEYEVENTF_SCANCODE |
      (down ? 0 : KEYEVENTF_KEYUP) |
      (ext ? KEYEVENTF_EXTENDEDKEY : 0)
    sendRaw(user, {
      type: INPUT_KEYBOARD,
      u: {
        ki: {
          wVk: 0,
          wScan: scancode & 0xff,
          dwFlags: flags,
          time: 0,
          dwExtraInfo: 0n,
        },
      },
    })
  }

  private async click(button: MacroButton, count: number): Promise<void> {
    const user = ensureApi()
    for (let i = 0; i < count; i++) {
      sendRaw(user, mouseInput(buttonFlagsDown(button)))
      await sleep(40)
      sendRaw(user, mouseInput(buttonFlagsUp(button)))
      if (i < count - 1) {
        await sleep(220)
      }
    }
  }

  private moveTo(x: number, y: number): void {
    const user = ensureApi()
    // Normalize to absolute screen coordinates.
    const ax = Math.round((x / screenW) * 65535)
    const ay = Math.round((y / screenH) * 65535)
    sendRaw(user, mouseInput(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, 0, ax, ay))
  }

  // Smoothly sweep the cursor between start and end. `durationMs` controls how
  // long the motion takes, giving the caller full pacing control.  Returns once
  // the target is reached, honouring the stop flag.
  private async sweepMove(x0: number, y0: number, x1: number, y1: number, durationMs: number): Promise<void> {
    const dx = x1 - x0
    const dy = y1 - y0
    const dist = Math.max(Math.abs(dx), Math.abs(dy))
    if (dist < 2 || durationMs < 8) {
      this.moveTo(x1, y1)
      return
    }
    const frameMs = 1000 / 120
    const frames = Math.max(2, Math.round(durationMs / frameMs))
    for (let f = 1; f <= frames; f++) {
      if (!this.playing || this.stopRequested) {
        return
      }
      const t = f / frames
      this.moveTo(Math.round(x0 + dx * t), Math.round(y0 + dy * t))
      await sleep(frameMs)
    }
  }

  private async executeStep(step: MacroStep): Promise<void> {
    const api = ensureApi()
    switch (step.type) {
      case 'mouseMove':
        // A single move step; the caller interpolates runs of consecutive moves.
        this.moveTo(step.x, step.y)
        break
      case 'mouseDown':
        this.moveTo(step.x, step.y)
        sendRaw(api, mouseInput(buttonFlagsDown(step.button)))
        break
      case 'mouseUp':
        this.moveTo(step.x, step.y)
        sendRaw(api, mouseInput(buttonFlagsUp(step.button)))
        break
      case 'mouseClick':
        this.moveTo(step.x, step.y)
        await this.click(step.button, step.count)
        break
      case 'mouseWheel':
        this.moveTo(step.x, step.y)
        sendRaw(
          api,
          mouseInput(MOUSEEVENTF_WHEEL, Math.round(step.amount * WHEEL_DELTA) >>> 0),
        )
        break
      case 'keyDown':
        this.sendKey(step.key, true)
        break
      case 'keyUp':
        this.sendKey(step.key, false)
        break
    }
  }

  async start(steps: MacroStep[], options: PlaybackOptions): Promise<void> {
    if (this.playing) {
      return
    }
    this.playing = true
    this.stopRequested = false

    try {
      const denominator = options.speed > 0 ? options.speed : 1
      // iterations: loop<0 => infinite, loop<=0 => once, loop>0 => that many.
      const iterations =
        options.loop < 0 ? Infinity : Math.max(1, Math.round(options.loop))
      let iteration = 0
      while (this.playing && iteration < iterations) {
        let first = true
        let i = 0
        while (i < steps.length) {
          if (!this.playing) {
            break
          }
          const step = steps[i]

          // Group consecutive mouseMove steps into a single smooth sweep. The
          // sweep consumes the combined delays of the whole run as its duration,
          // so it replaces both the leading sleep and the individual steps —
          // the cursor glides instead of teleporting (fixes "jerky" playback).
          if (step.type === 'mouseMove') {
            const x0 = step.x
            const y0 = step.y
            let j = i
            let totalDelay = 0
            while (
              j < steps.length &&
              steps[j].type === 'mouseMove' &&
              !this.stopRequested
            ) {
              totalDelay += steps[j].delayMs
              j++
            }
            const last = steps[j - 1] as { x: number; y: number }
            const duration = totalDelay / denominator
            await this.sweepMove(x0, y0, last.x, last.y, Math.max(0, duration))
            i = j
          } else {
            if (!first && step.delayMs > 0) {
              await sleep(step.delayMs / denominator)
            }
            first = false
            if (this.stopRequested) {
              break
            }
            await this.executeStep(step)
            i++
          }

          await sleep(0)
          if (this.stopRequested) {
            break
          }
        }
        iteration++
        if (this.stopRequested) {
          break
        }
      }
    } finally {
      this.playing = false
      this.stopRequested = false
    }
  }

  stop(): void {
    this.stopRequested = true
  }
}
