import { useEffect, useState } from 'react'
import type { AppEntry } from '@shared/apps'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

interface AppFormProps {
  initialName?: string
  initialPath?: string
  initialProcess?: string
  submitLabel: string
  busy: boolean
  onCancel?: () => void
  onSubmit: (name: string, path: string, processName: string) => Promise<boolean>
}

function AppForm({
  initialName = '',
  initialPath = '',
  initialProcess = '',
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: AppFormProps) {
  const [name, setName] = useState(initialName)
  const [path, setPath] = useState(initialPath)
  const [processName, setProcessName] = useState(initialProcess)

  const browse = async (): Promise<void> => {
    const selected = await window.api.dialogs.selectExecutable()
    if (selected !== null) {
      setPath(selected)
    }
  }

  const submit = async (): Promise<void> => {
    if (await onSubmit(name, path, processName)) {
      setName('')
      setPath('')
      setProcessName('')
    }
  }

  return (
    <div className="app-form">
      <label htmlFor="app-name">Name</label>
      <input
        id="app-name"
        type="text"
        placeholder="Discord"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />

      <label htmlFor="app-path">Executable path (optional)</label>
      <div className="input-row">
        <input
          id="app-path"
          type="text"
          placeholder="C:\Path\To\App.exe"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          disabled={busy}
        />
        <button type="button" onClick={browse} disabled={busy}>
          Browse…
        </button>
      </div>

      <label htmlFor="app-process">Process name (optional)</label>
      <input
        id="app-process"
        type="text"
        placeholder="Discord"
        value={processName}
        onChange={(event) => setProcessName(event.target.value)}
        disabled={busy}
      />

      <div className="actions">
        <button type="button" onClick={submit} disabled={busy}>
          {submitLabel}
        </button>
        {onCancel !== undefined && (
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function Applications() {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Result>({ kind: 'idle' })
  const [editing, setEditing] = useState<AppEntry | null>(null)

  useEffect(() => {
    void window.api.apps.list().then(setApps)
  }, [])

  const reload = async (): Promise<void> => {
    setApps(await window.api.apps.list())
  }

  const report = (outcome: { success: boolean; message: string }): void => {
    setStatus(outcome.success
      ? { kind: 'success', message: outcome.message }
      : { kind: 'error', message: outcome.message })
  }

  const addApp = async (name: string, path: string, processName: string): Promise<boolean> => {
    setBusy(true)
    const outcome = await window.api.apps.add({
      name,
      executablePath: path.trim().length > 0 ? path.trim() : null,
      processName: processName.trim().length > 0 ? processName.trim() : null,
    })
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      await reload()
    }
    return outcome.success
  }

  const saveEdit = async (name: string, path: string, processName: string): Promise<boolean> => {
    if (editing === null) {
      return false
    }
    setBusy(true)
    const outcome = await window.api.apps.update(editing.id, {
      name,
      executablePath: path.trim().length > 0 ? path.trim() : null,
      processName: processName.trim().length > 0 ? processName.trim() : null,
    })
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      setEditing(null)
      await reload()
    }
    return outcome.success
  }

  const removeApp = async (app: AppEntry): Promise<void> => {
    setBusy(true)
    const outcome = await window.api.apps.remove(app.id)
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      await reload()
    }
  }

  const runAppAction = async (app: AppEntry, action: 'launch' | 'restart' | 'stop'): Promise<void> => {
    setBusy(true)

    let outcome: { success: boolean; message: string }
    if (action === 'launch') {
      if (app.executablePath === null) {
        outcome = { success: false, message: 'No executable path set for this app.' }
      } else {
        outcome = await window.api.process.launch(app.executablePath)
      }
    } else if (app.processName === null) {
      outcome = { success: false, message: 'No process name set for this app.' }
    } else {
      outcome = action === 'restart'
        ? await window.api.process.restart(app.processName)
        : await window.api.process.kill(app.processName)
    }

    setBusy(false)
    report(outcome)
  }

  return (
    <div className="field">
      <h2 className="field-title">Applications</h2>
      <p className="help">
        Saved apps persist on disk and can be launched, restarted or stopped
        anytime.
      </p>

      {apps.length > 0 && (
        <ul className="app-list">
          {apps.map((app) => (
            <li key={app.id} className="app-item">
              {editing?.id === app.id ? (
                <AppForm
                  initialName={app.name}
                  initialPath={app.executablePath ?? ''}
                  initialProcess={app.processName ?? ''}
                  submitLabel="Save"
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSubmit={saveEdit}
                />
              ) : (
                <>
                  <div className="app-info">
                    <span className="app-name">{app.name}</span>
                    {app.executablePath !== null && (
                      <span className="app-detail">{app.executablePath}</span>
                    )}
                    {app.processName !== null && (
                      <span className="app-detail">process: {app.processName}</span>
                    )}
                  </div>
                  <div className="app-actions">
                    <button
                      type="button"
                      onClick={() => runAppAction(app, 'launch')}
                      disabled={busy}
                    >
                      Launch
                    </button>
                    {app.processName !== null && (
                      <>
                        <button
                          type="button"
                          onClick={() => runAppAction(app, 'restart')}
                          disabled={busy}
                        >
                          Restart
                        </button>
                        <button
                          type="button"
                          onClick={() => runAppAction(app, 'stop')}
                          disabled={busy}
                        >
                          Stop
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(app)
                        setStatus({ kind: 'idle' })
                      }}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => removeApp(app)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <AppForm submitLabel="Add application" busy={busy} onSubmit={addApp} />

      <ResultStatus result={status} />
    </div>
  )
}

export default Applications
