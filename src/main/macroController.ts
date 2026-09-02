import { BrowserWindow, globalShortcut } from 'electron'
import { macroRecorder } from './macroRecorder'
import { MacroPlayer } from './macroPlayer'
import { logEvent } from './logManager'
import { readSettings } from './settingsManager'
import type { MacroPhase, MacroState, PlaybackConfig } from '@shared/macros'
import type { MacroStep } from '@shared/macros'

// F9 (or whichever the user configured) is used as a global "stop" key while
// recording or playing back, matching common automation-tool conventions.

function stopAccelerator(): string {
  return readSettings().commandHotkeys.stop ?? 'F9'
}

function stopVkForRecorder(accel: string): number {
  // The recorder filters the stop key only when it's a plain single key (no
  // modifier chord), matching F1..F24. Chords are handled purely by
  // globalShortcut, which consumes them so they never get recorded.
  if (accel.includes('+')) {
    return 0
  }
  const key = accel.trim().toUpperCase()
  const f = /^F([1-9]|1[0-9]|2[0-4])$/.exec(key)
  if (f !== null) {
    return 0x70 + (Number(f[1]) - 1)
  }
  const simple: Record<string, number> = {
    ESCAPE: 0x1b,
    INSERT: 0x2d,
    DELETE: 0x2e,
    HOME: 0x24,
    END: 0x23,
    PAGEUP: 0x21,
    PAGEDOWN: 0x22,
  }
  return simple[key] ?? 0
}

const player = new MacroPlayer()
let liveSteps: MacroStep[] = []
let liveStepIndex = 0
let livePhase: MacroPhase = 'idle'
let stopRegistered = false
let activeStopAccel = 'F9'
let countTimer: ReturnType<typeof setInterval> | null = null

function pushState(): void {
  const state: MacroState = {
    phase: livePhase,
    steps: liveSteps.length,
    stepIndex: liveStepIndex,
    totalSteps: liveSteps.length,
  }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('macro:state', state)
  }
}

function ensureStopHotkey(): void {
  if (stopRegistered) {
    return
  }
  const stopAccel = stopAccelerator()
  activeStopAccel = stopAccel
  const ok = globalShortcut.register(stopAccel, () => {
    if (livePhase === 'recording') {
      const steps = macroRecorder.stop()
      liveSteps = steps
      livePhase = 'idle'
      stopTimers()
      unregisterStopHotkey()
      pushState()
      notify(`Recording stopped (${steps.length} steps).`)
      logEvent({
        source: 'macro',
        context: 'Recording',
        actionType: 'record',
        success: true,
        message: `Macro recording stopped by hotkey (${steps.length} steps).`,
      })
    } else if (livePhase === 'playing') {
      player.stop()
    }
  })
  if (ok) {
    stopRegistered = true
  }
}

function unregisterStopHotkey(): void {
  if (stopRegistered) {
    globalShortcut.unregister(activeStopAccel)
    stopRegistered = false
  }
}

function stopTimers(): void {
  if (countTimer !== null) {
    clearInterval(countTimer)
    countTimer = null
  }
}

function notify(message: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('macro:notice', message)
  }
}

export function startRecording(): { success: boolean; message: string } {
  if (livePhase === 'playing') {
    return { success: false, message: 'A macro is currently playing.' }
  }
  if (livePhase === 'recording') {
    return { success: false, message: 'Already recording.' }
  }
  macroRecorder.start(stopVkForRecorder(stopAccelerator()))
  liveSteps = []
  liveStepIndex = 0
  livePhase = 'recording'
  ensureStopHotkey()
  pushState()
  countTimer = setInterval(pushState, 500)
  logEvent({
    source: 'macro',
    context: 'Recording',
    actionType: 'record',
    success: true,
    message: 'Macro recording started. Press F9 to stop.',
  })
  return {
    success: true,
    message: 'Recording started. Press F9 to stop recording.',
  }
}

export function stopRecording(): { success: boolean; message: string } {
  if (livePhase !== 'recording') {
    return { success: false, message: 'Not recording.' }
  }
  const steps = macroRecorder.stop()
  liveSteps = steps
  livePhase = 'idle'
  stopTimers()
  unregisterStopHotkey()
  pushState()
  logEvent({
    source: 'macro',
    context: 'Recording',
    actionType: 'record',
    success: true,
    message: `Macro recording stopped (${steps.length} steps).`,
  })
  return {
    success: true,
    message: `Recording stopped (${steps.length} steps).`,
  }
}

export function discardRecording(): void {
  if (livePhase === 'recording') {
    macroRecorder.stop()
  }
  const wasDiscarding = liveSteps.length > 0
  liveSteps = []
  liveStepIndex = 0
  livePhase = 'idle'
  stopTimers()
  unregisterStopHotkey()
  pushState()
  if (wasDiscarding) {
    logEvent({
      source: 'macro',
      context: 'Recording',
      actionType: 'discard',
      success: true,
      message: 'Recording discarded.',
    })
  }
}

export function getPendingSteps(): MacroStep[] {
  return liveSteps
}

export async function startPlayback(
  steps: MacroStep[],
  config: PlaybackConfig,
): Promise<{ success: boolean; message: string }> {
  if (steps.length === 0) {
    return { success: false, message: 'Macro has no steps to play.' }
  }
  if (livePhase === 'recording') {
    return { success: false, message: 'Stop recording before playing.' }
  }
  if (livePhase === 'playing') {
    return { success: false, message: 'A macro is already playing.' }
  }
  liveSteps = steps
  liveStepIndex = 0
  livePhase = 'playing'
  ensureStopHotkey()
  pushState()
  notify('Playing… press F9 to stop.')
  logEvent({
    source: 'macro',
    context: 'Playback',
    actionType: 'play',
    success: true,
    message: `Macro playback started (${steps.length} steps${config.loop > 0 ? `, loop ${config.loop}×` : ''}).`,
  })

  void (async () => {
    try {
      await player.start(steps, {
        speed: config.speed,
        loop: config.loop,
      })
    } finally {
      livePhase = 'idle'
      liveStepIndex = 0
      stopTimers()
      unregisterStopHotkey()
      pushState()
      notify('Finished.')
      logEvent({
        source: 'macro',
        context: 'Playback',
        actionType: 'play',
        success: true,
        message: 'Macro playback finished.',
      })
    }
  })()

  return { success: true, message: 'Playback started.' }
}

export function stopPlayback(): { success: boolean; message: string } {
  if (livePhase !== 'playing') {
    return { success: false, message: 'Nothing is playing.' }
  }
  player.stop()
  return { success: true, message: 'Stopping playback…' }
}

export function getMacroState(): MacroState {
  return {
    phase: livePhase,
    steps: liveSteps.length,
    stepIndex: liveStepIndex,
    totalSteps: liveSteps.length,
  }
}

export function cleanupMacroController(): void {
  unregisterStopHotkey()
  if (livePhase === 'recording') {
    macroRecorder.stop()
  }
  if (livePhase === 'playing') {
    player.stop()
  }
  livePhase = 'idle'
  stopTimers()
}
