import { useEffect, useState } from 'react'
import HotkeyField from './HotkeyField'

const THEMES: { key: string; label: string; hint: string }[] = [
  { key: 'graphite-amber', label: 'Graphite + Amber', hint: 'Warm, calm' },
  { key: 'light', label: 'Light', hint: 'Paper — office-friendly' },
  { key: 'blue', label: 'Midnight Blue', hint: 'Cool, classic' },
  { key: 'system', label: 'Follow system', hint: 'Auto: dark or light' },
]

const COMMANDS: { key: string; label: string; hint: string }[] = [
  { key: 'record', label: 'Start recording', hint: 'Begin capturing a macro' },
  { key: 'stop', label: 'Stop', hint: 'Stop recording or playback' },
  { key: 'discard', label: 'Discard', hint: 'Discard the current recording' },
  { key: 'play', label: 'Play', hint: 'Play the last recorded macro' },
  {
    key: 'stopPlayback',
    label: 'Stop playback',
    hint: 'Interrupt the running macro',
  },
]

type CommandHotkeys = Record<
  'record' | 'stop' | 'discard' | 'play' | 'stopPlayback',
  string | null
>

const EMPTY_HOTKEYS: CommandHotkeys = {
  record: null,
  stop: null,
  discard: null,
  play: null,
  stopPlayback: null,
}

export default function Settings() {
  const [autostart, setAutostart] = useState(false)
  const [theme, setTheme] = useState('blue')
  const [hotkeys, setHotkeys] = useState<CommandHotkeys>({ ...EMPTY_HOTKEYS })

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setAutostart(s.autostart)
      setTheme(s.theme)
      setHotkeys({ ...EMPTY_HOTKEYS, ...(s.commandHotkeys ?? {}) })
    })
  }, [])

  const toggle = () => {
    const next = !autostart
    setAutostart(next)
    window.api.settings.set({ autostart: next })
  }

  const changeTheme = (key: string) => {
    setTheme(key)
    window.api.settings.set({ theme: key })
    document.documentElement.setAttribute('data-theme', key)
  }

  const changeHotkey = (
    command: keyof CommandHotkeys,
    value: string | null,
  ) => {
    const next = { ...hotkeys, [command]: value }
    setHotkeys(next)
    window.api.settings.set({ commandHotkeys: { [command]: value } })
  }

  return (
    <section className="settings-section">
      <h2 className="field-title">Settings</h2>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-label">
            <span className="settings-name">Autostart with system</span>
            <span className="settings-hint">
              Required for global hotkeys to work
            </span>
          </div>
          <button
            className={`toggle-switch${autostart ? ' on' : ''}`}
            onClick={toggle}
            type="button"
            role="switch"
            aria-checked={autostart}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-label">
          <span className="settings-name">Theme</span>
          <span className="settings-hint">
            Change the appearance of the interface
          </span>
        </div>
        <div className="theme-picker">
          {THEMES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`theme-option${theme === item.key ? ' active' : ''}`}
              onClick={() => changeTheme(item.key)}
            >
              <span className="theme-option-label">{item.label}</span>
              <span className="theme-option-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-label">
          <span className="settings-name">Command hotkeys</span>
          <span className="settings-hint">
            Global shortcuts for macro commands
          </span>
        </div>
        <div className="hotkey-command-list">
          {COMMANDS.map((cmd) => (
            <div className="hotkey-command-row" key={cmd.key}>
              <div className="settings-label hotkey-command-label">
                <span className="settings-name">{cmd.label}</span>
                <span className="settings-hint">{cmd.hint}</span>
              </div>
              <HotkeyField
                value={hotkeys[cmd.key as keyof CommandHotkeys]}
                onChange={(value) =>
                  changeHotkey(cmd.key as keyof CommandHotkeys, value)
                }
                disabled={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
