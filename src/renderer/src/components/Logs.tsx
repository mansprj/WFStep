import { useEffect, useState } from 'react'
import type { LogEntry } from '@shared/logs'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    void window.api.logs.list().then(setEntries)
    const offEntry = window.api.logs.onEntry((entry) => {
      setEntries((current) =>
        [entry, ...current.filter((existing) => existing.id !== entry.id)].slice(
          0,
          500,
        ),
      )
    })
    const offCleared = window.api.logs.onCleared(() => setEntries([]))
    return () => {
      offEntry()
      offCleared()
    }
  }, [])

  const clear = async (): Promise<void> => {
    await window.api.logs.clear()
    setEntries([])
  }

  return (
    <div className="field">
      <h2 className="field-title">Logs</h2>
      <p className="help">
        Everything that ran — workflows, their steps, and action runner tests.
      </p>

      {entries.length > 0 && (
        <ul className="log-list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`log-entry ${entry.success ? 'success' : 'error'}`}
            >
              <span className="log-time">{formatTime(entry.timestamp)}</span>
              <span className={`log-badge ${entry.source}`}>
                {entry.source === 'workflow' ? 'Workflow' : 'Action'}
              </span>
              <span className="log-context" title={entry.context}>
                {entry.context}
              </span>
              <span className="log-message">{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 && <p className="help">No logs yet.</p>}

      <div className="actions">
        <button type="button" onClick={clear} disabled={entries.length === 0}>
          Clear
        </button>
      </div>
    </div>
  )
}

export default Logs
