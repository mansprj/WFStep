import { useEffect, useRef, useState } from 'react'
import { codeToAccelerator } from './hotkeyAccelerator'

export default function HotkeyField({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled: boolean
}) {
  const [recording, setRecording] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!recording) {
      return
    }
    const el = ref.current
    if (el === null) {
      return
    }
    const stop = (): void => setRecording(false)
    el.addEventListener('blur', stop)
    return () => el.removeEventListener('blur', stop)
  }, [recording])

  const record = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setRecording(false)
      return
    }
    const accelerator = codeToAccelerator(event)
    if (accelerator === null) {
      return
    }
    onChange(accelerator)
    setRecording(false)
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`hotkey-field${recording ? ' recording' : ''}`}
      disabled={disabled}
      onClick={() => setRecording(true)}
      onKeyDown={record}
      title={
        recording
          ? 'Press the combination (Ctrl or Alt required)'
          : 'Click, then press the combination'
      }
    >
      {recording ? (
        <span className="hotkey-recording">Press Ctrl or Alt + a key…</span>
      ) : (
        <span className="hotkey-keys">{value ?? 'None'}</span>
      )}
      {!recording && value !== null && (
        <span
          className="hotkey-clear"
          role="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onChange(null)
          }}
        >
          ×
        </span>
      )}
    </button>
  )
}
