import { useEffect, useState } from 'react'

const THEMES: { key: string; label: string; hint: string }[] = [
  { key: 'graphite-amber', label: 'Graphite + Amber', hint: 'Warm, calm' },
  { key: 'light', label: 'Light', hint: 'Paper — office-friendly' },
  { key: 'blue', label: 'Midnight Blue', hint: 'Cool, classic' },
  { key: 'system', label: 'Follow system', hint: 'Auto: dark or light' },
]

export default function Settings() {
  const [autostart, setAutostart] = useState(false)
  const [theme, setTheme] = useState('blue')

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setAutostart(s.autostart)
      setTheme(s.theme)
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
    </section>
  )
}
