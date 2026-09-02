import { globalShortcut } from 'electron'
import { readSettings } from './settingsManager'
import type { CommandKey } from './settingsManager'
import {
  discardRecording,
  getPendingSteps,
  startPlayback,
  startRecording,
  stopPlayback,
} from './macroController'

// Command hotkeys are always-on global shortcuts for macro actions. The "stop"
// command is intentionally excluded here: it is registered by macroController on
// demand (only while recording/playing) so it never collides.
const COMMAND_KEYS: CommandKey[] = ['record', 'discard', 'play', 'stopPlayback']

const registered = new Map<CommandKey, string>()

function handlers(): Record<CommandKey, () => void> {
  return {
    record: () => {
      startRecording()
    },
    discard: () => {
      discardRecording()
    },
    play: () => {
      const steps = getPendingSteps()
      if (steps.length > 0) {
        void startPlayback(steps, { speed: 1, loop: 0 })
      }
    },
    stopPlayback: () => {
      stopPlayback()
    },
    stop: () => {
      // handled by macroController during active sessions
    },
  }
}

export function refreshCommandHotkeys(): void {
  for (const accel of registered.values()) {
    globalShortcut.unregister(accel)
  }
  registered.clear()

  const hotkeys = readSettings().commandHotkeys
  const dispatch = handlers()
  for (const cmd of COMMAND_KEYS) {
    const accel = hotkeys[cmd]
    if (accel === null) {
      continue
    }
    const ok = globalShortcut.register(accel, dispatch[cmd])
    if (ok) {
      registered.set(cmd, accel)
    }
  }
}

export function clearCommandHotkeys(): void {
  for (const accel of registered.values()) {
    globalShortcut.unregister(accel)
  }
  registered.clear()
}
