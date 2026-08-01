import { useState } from 'react'
import './App.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function App() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const handleRestartDiscord = async (): Promise<void> => {
    setStatus({ kind: 'working' })
    const result = await window.api.restartDiscord()
    setStatus(
      result.success
        ? { kind: 'success', message: result.message }
        : { kind: 'error', message: result.message },
    )
  }

  const busy = status.kind === 'working'

  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Desktop automation</p>

      <button
        type="button"
        className="restart-button"
        onClick={handleRestartDiscord}
        disabled={busy}
      >
        {busy ? 'Restarting…' : 'Restart Discord'}
      </button>

      {status.kind === 'success' && (
        <p className="status success">{status.message}</p>
      )}
      {status.kind === 'error' && <p className="status error">{status.message}</p>}
    </div>
  )
}

export default App
