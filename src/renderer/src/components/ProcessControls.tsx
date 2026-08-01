import { useState } from 'react'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

type Action = 'status' | 'restart' | 'kill' | 'launch'

const WORKING_LABELS: Record<Action, string> = {
  status: 'Checking status…',
  restart: 'Restarting…',
  kill: 'Stopping…',
  launch: 'Launching…',
}

function ProcessControls() {
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

  const browse = async (): Promise<void> => {
    const path = await window.api.dialogs.selectExecutable()
    if (path !== null) {
      setExePath(path)
    }
  }

  const busy = result.kind === 'working'

  return (
    <div className="field">
      <h2 className="field-title">Process management</h2>

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
        <button type="button" onClick={browse} disabled={busy}>
          Browse…
        </button>
        <button type="button" onClick={() => run('launch')} disabled={busy}>
          Launch
        </button>
      </div>

      <ResultStatus result={result} />
    </div>
  )
}

export default ProcessControls
