import { useEffect, useState } from 'react'

export default function Settings() {
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    window.api.settings.get().then((s) => setAutostart(s.autostart))
  }, [])

  const toggle = () => {
    const next = !autostart
    setAutostart(next)
    window.api.settings.set({ autostart: next })
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
    </section>
  )
}
