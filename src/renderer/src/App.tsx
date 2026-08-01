import { useState } from 'react'
import './App.css'

type Action = 'status' | 'restart' | 'kill' | 'launch'

type Result =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'info'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

const WORKING_LABELS: Record<Action, string> = {
  status: 'Checking status…',
  restart: 'Restarting…',
  kill: 'Stopping…',
  launch: 'Launching…',
}

function App() {
  const [processName, setProcessName] = useState('Discord')
  const [exePath, setExePath] = useState('')
  const [result, setResult] = useState<Result>({ kind: 'idle' })

  const run = async (action: Action): Promise<void> => {
    setResult({ kind: 'working', label: WORKING_LABELS[action] })

    if (action === 'status') {
      const status = await window.api.process.status(processName)
      setResult({ kind: 'info', message: status.message })
      return
    }

    if (action === 'launch') {
      const outcome = await window.api.process.launch(exePath)
      setResult(outcome.success
        ? { kind: 'success', message: outcome.message }
        : { kind: 'error', message: outcome.message })
      return
    }

    const outcome =
      action === 'restart'
        ? await window.api.process.restart(processName)
        : await window.api.process.kill(processName)
    setResult(outcome.success
      ? { kind: 'success', message: outcome.message }
      : { kind: 'error', message: outcome.message })
  }

  const busy = result.kind === 'working'

  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Process management</p>

      <div className="field">
        <label htmlFor="process-name">Process name</label>
        <input
          id="process-name"
          type="text"
          value={processName}
          onChange={(event) => setProcessName(event.target.value)}
          disabled={busy}
        />
        <div className="actions">
          <button type="button" onClick={() => run('status')} disabled={busy}>
            Check status
          </button>
          <button type="button" onClick={() => run('restart')} disabled={busy}>
            Restart
          </button>
          <button type="button" onClick={() => run('kill')} disabled={busy}>
            Stop
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="exe-path">Executable path</label>
        <input
          id="exe-path"
          type="text"
          placeholder="C:\Path\To\App.exe"
          value={exePath}
          onChange={(event) => setExePath(event.target.value)}
          disabled={busy}
        />
        <div className="actions">
          <button type="button" onClick={() => run('launch')} disabled={busy}>
            Launch
          </button>
        </div>
      </div>

      {result.kind === 'working' && <p className="status working">{result.label}</p>}
      {result.kind === 'info' && <p className="status info">{result.message}</p>}
      {result.kind === 'success' && (
        <p className="status success">{result.message}</p>
      )}
      {result.kind === 'error' && <p className="status error">{result.message}</p>}
    </div>
  )
}

export default App
