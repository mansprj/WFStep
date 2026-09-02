import { WinLowLevelHooks } from './winLowLevelHooks'
import type { KeyHookInfo, MouseHookInfo } from './winLowLevelHooks'
import type { MacroButton, MacroStep } from '@shared/macros'

// Movement coalescing thresholds: keep recordings compact while staying faithful.
const MOVE_MIN_INTERVAL_MS = 20
const MOVE_MIN_DISTANCE_PX = 8
const MOVE_BURST_GAP_MS = 60
const DRAG_THRESHOLD_PX = 4
const DOUBLE_CLICK_MAX_MS = 350
const DOUBLE_CLICK_MAX_PX = 5

// Keycode encoding matches the playback layer: normal keys use their Windows
// scan code, extended keys (arrows, Home/End, numpad enter…) carry an 0xE000
// prefix just like libuiohook did.
function keyFrom(info: KeyHookInfo): number {
  return info.extended ? 0xe000 | (info.scanCode & 0xff) : info.scanCode
}

export interface RecordingState {
  active: boolean
  stepCount: number
}

export class MacroRecorder {
  private active = false
  private hooks: WinLowLevelHooks | null = null
  private steps: MacroStep[] = []
  private lastEventAt = 0
  private moveLastAt = 0
  private moveLastX = -1
  private moveLastY = -1
  // Drag tracking: a single held button is enough here.
  private pressedButton: MacroButton | null = null
  private pressedMoved = false
  private pressStartX = 0
  private pressStartY = 0
  // Keys currently held down, so auto-repeat keydowns are not recorded twice.
  private heldKeys = new Set<number>()
  // Double-click merging (two quick releases close together become count 2).
  private lastClickStep = -1
  private lastClickTime = 0
  // Index of the provisional mouseDown pushed at press time; spliced out when a
  // quick release turns out to be a simple click instead of a drag.
  private pendingDownIndex = -1
  private stopVk = 0

  get isActive(): boolean {
    return this.active
  }

  get stepCount(): number {
    return this.steps.length
  }

  // Event "time" from the hook is unreliable (different clocks / wraparound),
  // so delays and coalescing use the monotonic performance clock instead.
  private nowMs(): number {
    return performance.now()
  }

  private push(step: MacroStep, now: number): void {
    const delay = this.steps.length === 0 ? 0 : Math.max(0, now - this.lastEventAt)
    step.delayMs = Math.round(delay)
    this.steps.push(step)
    this.lastEventAt = now
  }

  private onKeyDown(e: KeyHookInfo): void {
    if (e.injected) {
      return
    }
    if (e.vkCode === this.stopVk) {
      this.stop()
      return
    }
    const key = keyFrom(e)
    if (this.heldKeys.has(key)) {
      return
    }
    this.heldKeys.add(key)
    this.push({ type: 'keyDown', delayMs: 0, key }, this.nowMs())
  }

  private onKeyUp(e: KeyHookInfo): void {
    if (e.injected) {
      return
    }
    if (e.vkCode === this.stopVk) {
      return
    }
    const key = keyFrom(e)
    if (!this.heldKeys.has(key)) {
      return
    }
    this.heldKeys.delete(key)
    this.push({ type: 'keyUp', delayMs: 0, key }, this.nowMs())
  }

  private onMouseDown(e: MouseHookInfo): void {
    if (e.injected) {
      return
    }
    const button = e.button
    if (button === null) {
      return
    }
    this.pressedButton = button
    this.pressedMoved = false
    this.pressStartX = e.x
    this.pressStartY = e.y
    this.push(
      {
        type: 'mouseDown',
        delayMs: 0,
        x: Math.round(e.x),
        y: Math.round(e.y),
        button,
      },
      this.nowMs(),
    )
    this.pendingDownIndex = this.steps.length - 1
  }

  private onMouseUp(e: MouseHookInfo): void {
    if (e.injected) {
      return
    }
    const button = e.button
    if (button === null || this.pressedButton !== button) {
      this.pressedButton = null
      this.pressedMoved = false
      return
    }
    const x = Math.round(e.x)
    const y = Math.round(e.y)
    if (this.pressedMoved) {
      // A press that moved: record the matching release (drag). The mouseDown
      // step was already pushed at press time.
      this.push({ type: 'mouseUp', delayMs: 0, x, y, button }, this.nowMs())
    } else {
      // Simple click: the provisional mouseDown is replaced by a mouseClick.
      if (
        this.pendingDownIndex >= 0 &&
        this.steps[this.pendingDownIndex]?.type === 'mouseDown'
      ) {
        this.steps.splice(this.pendingDownIndex, 1)
      }
      this.pendingDownIndex = -1
      // Merge with the previous click if this was a double-click.
      const prev = this.steps[this.lastClickStep]
      const sameSpan =
        prev !== undefined &&
        prev.type === 'mouseClick' &&
        prev.button === button &&
        this.nowMs() - this.lastClickTime <= DOUBLE_CLICK_MAX_MS &&
        (prev.x - x) * (prev.x - x) + (prev.y - y) * (prev.y - y) <=
          DOUBLE_CLICK_MAX_PX * DOUBLE_CLICK_MAX_PX
      if (sameSpan) {
        prev.count = Math.min(3, (prev.count ?? 1) + 1)
        prev.x = x
        prev.y = y
        this.lastClickStep = this.steps.indexOf(prev)
        this.lastClickTime = this.nowMs()
        this.lastEventAt = this.nowMs()
      } else {
        this.push(
          { type: 'mouseClick', delayMs: 0, x, y, button, count: 1 },
          this.nowMs(),
        )
        this.lastClickStep = this.steps.length - 1
        this.lastClickTime = this.nowMs()
      }
    }
    this.pressedButton = null
    this.pressedMoved = false
  }

  private onMouseMove(e: MouseHookInfo): void {
    if (e.injected) {
      return
    }
    // Track drags so a press+move+release records a proper drag, not a click.
    if (this.pressedButton !== null) {
      const dx = e.x - this.pressStartX
      const dy = e.y - this.pressStartY
      if (
        !this.pressedMoved &&
        dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
      ) {
        this.pressedMoved = true
      }
    }

    const x = Math.round(e.x)
    const y = Math.round(e.y)
    const now = this.nowMs()
    const movedSinceLast =
      this.moveLastX < 0 ||
      (x - this.moveLastX) * (x - this.moveLastX) +
        (y - this.moveLastY) * (y - this.moveLastY) >=
        MOVE_MIN_DISTANCE_PX * MOVE_MIN_DISTANCE_PX
    // Start of a burst is always recorded; within a burst require enough time
    // to keep the recording compact.
    const isBurstStart = now - this.moveLastAt > MOVE_BURST_GAP_MS
    if (!isBurstStart && now - this.moveLastAt < MOVE_MIN_INTERVAL_MS) {
      this.moveLastX = x
      this.moveLastY = y
      return
    }
    if (!movedSinceLast && !isBurstStart) {
      this.moveLastX = x
      this.moveLastY = y
      return
    }
    this.moveLastAt = now
    this.moveLastX = x
    this.moveLastY = y
    this.push({ type: 'mouseMove', delayMs: 0, x, y }, now)
  }

  private onWheel(e: MouseHookInfo): void {
    if (e.injected) {
      return
    }
    if (e.wheelAmount === 0) {
      return
    }
    this.push(
      {
        type: 'mouseWheel',
        delayMs: 0,
        x: Math.round(e.x),
        y: Math.round(e.y),
        amount: e.wheelAmount,
      },
      this.nowMs(),
    )
  }

  start(stopVk: number): void {
    if (this.active) {
      return
    }
    this.active = true
    this.steps = []
    this.lastEventAt = 0
    this.moveLastAt = 0
    this.moveLastX = -1
    this.moveLastY = -1
    this.pressedButton = null
    this.pressedMoved = false
    this.heldKeys.clear()
    this.lastClickStep = -1
    this.lastClickTime = 0
    this.pendingDownIndex = -1
    this.stopVk = stopVk

    this.hooks = new WinLowLevelHooks({
      onKeyDown: (e) => this.onKeyDown(e),
      onKeyUp: (e) => this.onKeyUp(e),
      onMouseDown: (e) => this.onMouseDown(e),
      onMouseUp: (e) => this.onMouseUp(e),
      onMouseMove: (e) => this.onMouseMove(e),
      onWheel: (e) => this.onWheel(e),
    })
    this.hooks.install()
  }

  stop(): MacroStep[] {
    if (!this.active) {
      return this.steps
    }
    this.active = false
    this.hooks?.uninstall()
    this.hooks = null
    this.heldKeys.clear()
    this.stopVk = 0
    return this.steps
  }
}

export const macroRecorder = new MacroRecorder()