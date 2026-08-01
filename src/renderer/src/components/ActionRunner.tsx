import { useState } from 'react'
import type { AutomationAction } from '@shared/actions'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

type ActionKind = AutomationAction['type']

const KIND_LABELS: Record<ActionKind, string> = {
  start: 'Start process',
  stop: 'Stop process',
  restart: 'Restart process',
  delay: 'Delay',
  shell: 'Run shell command',
  openUrl: 'Open URL',
  openFolder: 'Open folder',
}

const KIND_PLACEHOLDERS: Record<ActionKind, string> = {
  start: 'C:\\Path\\To\\App.exe',
  stop: 'Process name (e.g. Discord)',
  restart: 'Process name (e.g. Discord)',
  delay: 'Milliseconds (e.g. 2000)',
  shell: 'Command (e.g. echo hello)',
  openUrl: 'https://example.com',
  openFolder: 'C:\\Path\\To\\Folder',
}

const KIND_HELP: Record<ActionKind, string> = {
  start: 'Launch an executable file.',
  stop: 'Force stop a running process by name.',
  restart: 'Restart a running process by name.',
  delay: 'Wait the given number of milliseconds.',
  shell: 'Run a shell command.',
  openUrl: 'Open a web address (http/https only).',
  openFolder: 'Open a folder in Explorer.',
}

function ActionRunner() {
  const [kind, setKind] = useState<ActionKind>('start')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<Result>({ kind: 'idle' })

  const busy = result.kind === 'working'

  const action = (): AutomationAction => {
    switch (kind) {
      case 'start':
        return { type: 'start', executablePath: value }
      case 'stop':
        return { type: 'stop', processName: value }
      case 'restart':
        return { type: 'restart', processName: value }
      case 'delay':
        return { type: 'delay', ms: Number(value) }
      case 'shell':
        return { type: 'shell', command: value }
      case 'openUrl':
        return { type: 'openUrl', url: value }
      case 'openFolder':
        return { type: 'openFolder', path: value }
    }
  }

  const browse = async (): Promise<void> => {
    const path = await window.api.dialogs.selectExecutable()
    if (path !== null) {
      setValue(path)
    }
  }

  const run = async (): Promise<void> => {
    setResult({ kind: 'working', label: 'Running action…' })
    const outcome = await window.api.actions.run(action())
    setResult(outcome.success
      ? { kind: 'success', message: outcome.message }
      : { kind: 'error', message: outcome.message })
  }

  return (
    <div className="field">
      <h2 className="field-title">Action runner</h2>

      <label htmlFor="action-kind">Action type</label>
      <select
        id="action-kind"
        value={kind}
        onChange={(event) => {
          setKind(event.target.value as ActionKind)
          setValue('')
        }}
        disabled={busy}
      >
        {Object.entries(KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="action-value">Parameter</label>
      <div className="input-row">
        <input
          id="action-value"
          type="text"
          placeholder={KIND_PLACEHOLDERS[kind]}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
        />
        {kind === 'start' && (
          <button type="button" onClick={browse} disabled={busy}>
            Browse…
          </button>
        )}
      </div>
      <p className="help">{KIND_HELP[kind]}</p>

      <div className="actions">
        <button type="button" onClick={run} disabled={busy}>
          Run action
        </button>
      </div>

      <ResultStatus result={result} />
    </div>
  )
}

export default ActionRunner
