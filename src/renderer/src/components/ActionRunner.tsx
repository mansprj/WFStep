import { useState } from 'react'
import {
  actionFromInput,
  KIND_HELP,
  KIND_LABELS,
  KIND_PLACEHOLDERS,
  type ActionKind,
} from '../actionForm'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

function ActionRunner() {
  const [kind, setKind] = useState<ActionKind>('start')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<Result>({ kind: 'idle' })

  const busy = result.kind === 'working'

  const browse = async (): Promise<void> => {
    const path = await window.api.dialogs.selectExecutable()
    if (path !== null) {
      setValue(path)
    }
  }

  const run = async (): Promise<void> => {
    setResult({ kind: 'working', label: 'Running action…' })
    const outcome = await window.api.actions.run(actionFromInput(kind, value))
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
