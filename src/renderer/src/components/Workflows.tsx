import { useEffect, useRef, useState } from 'react'
import { describeActionShort } from '@shared/actions'
import type { AutomationAction } from '@shared/actions'
import type { Workflow } from '@shared/workflows'
import {
  actionFromInput,
  inputFromAction,
  KIND_LABELS,
  KIND_PLACEHOLDERS,
  type ActionKind,
} from '../actionForm'
import type { Result } from '../result'
import ActionIcon from './ActionIcon'
import ResultStatus from './ResultStatus'

interface StepRow {
  kind: ActionKind
  value: string
}

function displayName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.exe$/i, '')
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

// Builds an Electron accelerator from the physical key (event.code), so the
// combination works regardless of the keyboard layout (e.g. Cyrillic).
function codeToAccelerator(event: React.KeyboardEvent): string | null {
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0) {
    return null
  }

  const code = event.code
  if (/^(Control|Alt|Shift|Meta)(Left|Right)$/.test(code)) {
    return null
  }

  const letter = /^Key([A-Z])$/.exec(code)?.[1]
  if (letter !== undefined) {
    return [...modifiers, letter].join('+')
  }
  const digit = /^Digit([0-9])$/.exec(code)?.[1]
  if (digit !== undefined) {
    return [...modifiers, digit].join('+')
  }
  const numpad = /^Numpad([0-9])$/.exec(code)?.[1]
  if (numpad !== undefined) {
    return [...modifiers, `num${numpad}`].join('+')
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) {
    return [...modifiers, code].join('+')
  }

  const mapped = NAMED_KEYS[code]
  return mapped === undefined ? null : [...modifiers, mapped].join('+')
}

function HotkeyField({
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

function WorkflowIcon({ path }: { path: string | null }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (path === null) {
      return
    }
    let cancelled = false
    void window.api.icons.get(path).then((dataUrl) => {
      if (!cancelled) {
        setSrc(dataUrl)
      }
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (src === null) {
    return (
      <span className="workflow-icon default" title="No icon">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.2 3.2L4.3 4.3M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    )
  }
  return <img className="workflow-icon" src={src} alt="" />
}

// Returns the program (exe path or process name) an action refers to, so the
// chain can show that program's icon when one is involved.
function actionProgramSource(action: AutomationAction): string | null {
  switch (action.type) {
    case 'start':
      return action.executablePath.trim().length > 0 ? action.executablePath : null
    case 'stop':
    case 'restart':
      return action.processName.trim().length > 0 ? action.processName : null
    default:
      return null
  }
}

// Describes which icon the chain should try to show for an action: the icon of
// the program it controls, or the favicon of the site it opens.
function iconRequest(
  action: AutomationAction,
): { kind: 'program' | 'favicon'; value: string } | null {
  const program = actionProgramSource(action)
  if (program !== null) {
    return { kind: 'program', value: program }
  }
  if (action.type === 'openUrl' && action.url.trim().length > 0) {
    return { kind: 'favicon', value: action.url }
  }
  return null
}

function StepLabel({ action }: { action: AutomationAction }) {
  const url = action.type === 'openUrl' ? action.url : null
  const [loaded, setLoaded] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    if (url === null) {
      return
    }
    const promise = window.api.pages?.title?.(url)
    if (promise === undefined) {
      return
    }
    let cancelled = false
    void promise
      .then((title) => {
        if (!cancelled && title !== null) {
          setLoaded({ url, title })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [url])

  if (url !== null && loaded !== null && loaded.url === url) {
    return <>Open {loaded.title}</>
  }
  return <>{describeActionShort(action)}</>
}

function StepIcon({ action }: { action: AutomationAction }) {
  const request = iconRequest(action)
  const kind = request?.kind ?? null
  const value = request?.value ?? null
  const [loaded, setLoaded] = useState<{ value: string; src: string } | null>(null)

  useEffect(() => {
    if (kind === null || value === null) {
      return
    }
    let cancelled = false
    const promise =
      kind === 'favicon'
        ? window.api.favicons.get(value)
        : window.api.icons.get(value)
    void promise.then((dataUrl) => {
      if (!cancelled) {
        setLoaded(dataUrl === null ? null : { value, src: dataUrl })
      }
    })
    return () => {
      cancelled = true
    }
  }, [kind, value])

  const hasProgramIcon = loaded !== null && loaded.value === value

  if (hasProgramIcon && kind === 'program') {
    return (
      <span className="step-program-icon badged">
        <img src={loaded.src} alt="" />
        <span className="step-program-badge">
          <ActionIcon kind={action.type} />
        </span>
      </span>
    )
  }
  if (hasProgramIcon) {
    return <img className="step-program-icon" src={loaded.src} alt="" />
  }
  return <ActionIcon kind={action.type} />
}

interface WorkflowEditorProps {
  initialName?: string
  initialSteps?: StepRow[]
  initialIcon?: string | null
  initialHotkey?: string | null
  submitLabel: string
  busy: boolean
  onCancel?: () => void
  onSubmit: (
    name: string,
    steps: StepRow[],
    iconPath: string | null,
    hotkey: string | null,
  ) => Promise<boolean>
}

function WorkflowEditor({
  initialName = '',
  initialSteps = [],
  initialIcon = null,
  initialHotkey = null,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: WorkflowEditorProps) {
  const [name, setName] = useState(initialName)
  const [steps, setSteps] = useState<StepRow[]>(initialSteps)
  const [iconPath, setIconPath] = useState<string | null>(initialIcon)
  const [hotkey, setHotkey] = useState<string | null>(initialHotkey)

  // Programs referenced by "Start process" steps, offered as shortcuts when
  // adding Stop/Restart steps so the same path is reused.
  const startPaths = [
    ...new Set(
      steps
        .filter((step) => step.kind === 'start' && step.value.trim().length > 0)
        .map((step) => step.value.trim()),
    ),
  ]

  const updateStep = (index: number, patch: Partial<StepRow>): void => {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    )
  }

  const addStep = (): void => {
    setSteps((current) => [...current, { kind: 'start', value: '' }])
  }

  const removeStep = (index: number): void => {
    setSteps((current) => current.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, delta: number): void => {
    setSteps((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = [...current]
      const [step] = next.splice(index, 1)
      next.splice(target, 0, step)
      return next
    })
  }

  const browse = async (index: number): Promise<void> => {
    const step = steps[index]
    const path =
      step.kind === 'openFolder'
        ? await window.api.dialogs.selectFolder()
        : await window.api.dialogs.selectExecutable()
    if (path !== null) {
      updateStep(index, { value: path })
    }
  }

  const chooseIcon = async (): Promise<void> => {
    const path = await window.api.dialogs.selectImage()
    if (path !== null) {
      setIconPath(path)
    }
  }

  const submit = async (): Promise<void> => {
    if (await onSubmit(name, steps, iconPath, hotkey)) {
      setName('')
      setSteps([])
      setIconPath(null)
      setHotkey(null)
    }
  }

  return (
    <div className="workflow-editor">
      <label htmlFor="workflow-name">Workflow name</label>
      <input
        id="workflow-name"
        type="text"
        placeholder="e.g. Gaming, Work, Regular"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />

      <label htmlFor="workflow-icon">Icon (optional)</label>
      <div className="input-row">
        <WorkflowIcon key={iconPath ?? 'none'} path={iconPath} />
        <input
          id="workflow-icon"
          type="text"
          placeholder="Path to image"
          value={iconPath ?? ''}
          onChange={(event) => setIconPath(event.target.value)}
          disabled={busy}
        />
        <button type="button" onClick={chooseIcon} disabled={busy}>
          Choose…
        </button>
        {iconPath !== null && (
          <button type="button" onClick={() => setIconPath(null)} disabled={busy}>
            Clear
          </button>
        )}
      </div>

      <label htmlFor="workflow-hotkey">Hotkey (optional)</label>
      <HotkeyField value={hotkey} onChange={setHotkey} disabled={busy} />
      <p className="hotkey-hint">
        Click, then press the keys. The combination must include{' '}
        <strong>Ctrl</strong> or <strong>Alt</strong>, e.g.{' '}
        <kbd>Ctrl</kbd>+<kbd>9</kbd> or <kbd>Alt</kbd>+<kbd>M</kbd>. The
        shortcut works while AutomationHub runs in the tray.
      </p>

      <ul className="workflow-steps">
        {steps.map((step, index) => (
          <li key={index} className="workflow-step">
            <div className="workflow-step-head">
              <span className="workflow-step-index">{index + 1}</span>
              <ActionIcon kind={step.kind} />
              <select
                value={step.kind}
                onChange={(event) =>
                  updateStep(index, { kind: event.target.value as ActionKind })
                }
                disabled={busy}
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => moveStep(index, -1)}
                disabled={busy || index === 0}
                title="Move step up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(index, 1)}
                disabled={busy || index === steps.length - 1}
                title="Move step down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(index)}
                disabled={busy}
                title="Remove step"
              >
                ×
              </button>
            </div>
            <div className="input-row">
              <input
                type="text"
                placeholder={KIND_PLACEHOLDERS[step.kind]}
                value={step.value}
                onChange={(event) =>
                  updateStep(index, { value: event.target.value })
                }
                disabled={busy}
              />
              {(step.kind === 'start' ||
                step.kind === 'stop' ||
                step.kind === 'restart' ||
                step.kind === 'openFolder') && (
                <button
                  type="button"
                  className="workflow-browse"
                  onClick={() => browse(index)}
                  disabled={busy}
                  title={
                    step.kind === 'openFolder'
                      ? 'Browse for folder'
                      : 'Browse for executable'
                  }
                >
                  Browse…
                </button>
              )}
            </div>
            {(step.kind === 'stop' || step.kind === 'restart') &&
              startPaths.length > 0 && (
                <div className="workflow-suggestions">
                  <span className="workflow-suggestions-label">
                    From this workflow:
                  </span>
                  {startPaths.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className="workflow-suggestion"
                      onClick={() => updateStep(index, { value: path })}
                      disabled={busy}
                      title={path}
                    >
                      {displayName(path)}
                    </button>
                  ))}
                </div>
              )}
          </li>
        ))}
      </ul>

      <div className="actions">
        <button type="button" onClick={addStep} disabled={busy}>
          Add step
        </button>
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

function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Result>({ kind: 'idle' })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [progress, setProgress] = useState<Result>({ kind: 'idle' })

  useEffect(() => {
    void window.api.workflows.list().then(setWorkflows)
  }, [])

  useEffect(
    () =>
      window.api.workflows.onProgress((update) => {
        if (update.status === 'started') {
          setProgress({
            kind: 'working',
            label: `Step ${update.stepIndex + 1}/${update.totalSteps}: ${update.message}`,
          })
        } else if (update.status === 'succeeded') {
          setProgress({ kind: 'info', message: update.message })
        } else if (update.status === 'failed' || update.status === 'cancelled') {
          setProgress({ kind: 'error', message: update.message })
          setRunId(null)
        } else {
          setProgress({ kind: 'success', message: update.message })
          setRunId(null)
        }
      }),
    [],
  )

  const reload = async (): Promise<void> => {
    setWorkflows(await window.api.workflows.list())
  }

  const report = (outcome: { success: boolean; message: string }): void => {
    setStatus(outcome.success
      ? { kind: 'success', message: outcome.message }
      : { kind: 'error', message: outcome.message })
  }

  const save = async (
    id: string | null,
    name: string,
    steps: StepRow[],
    iconPath: string | null,
    hotkey: string | null,
  ): Promise<boolean> => {
    const actions = steps
      .filter((step) => step.value.trim().length > 0)
      .map((step) => actionFromInput(step.kind, step.value))

    setBusy(true)
    const outcome =
      id === null
        ? await window.api.workflows.add({ name, actions, iconPath, hotkey })
        : await window.api.workflows.update(id, {
            name,
            actions,
            iconPath,
            hotkey,
          })
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      setCreating(false)
      setEditing(null)
      await reload()
    }
    return outcome.success
  }

  const removeWorkflow = async (workflow: Workflow): Promise<void> => {
    setBusy(true)
    const outcome = await window.api.workflows.remove(workflow.id)
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      await reload()
    }
  }

  const runWorkflow = async (workflow: Workflow): Promise<void> => {
    setStatus({ kind: 'idle' })
    setProgress({ kind: 'idle' })
    const outcome = await window.api.workflows.run(workflow.id)
    if (outcome.success) {
      setRunId(workflow.id)
    } else {
      setStatus({ kind: 'error', message: outcome.message })
    }
  }

  const cancelRun = async (): Promise<void> => {
    await window.api.workflows.cancel()
  }

  const running = runId !== null
  const progressClass =
    progress.kind === 'error'
      ? 'error'
      : progress.kind === 'success'
        ? 'success'
        : progress.kind === 'info'
          ? 'info'
          : progress.kind === 'working'
            ? 'working'
            : undefined

  return (
    <div className="field">
      <h2 className="field-title">Workflows</h2>
      <p className="help">
        Combine actions into sequences. Run them step by step from this panel.
      </p>

      {workflows.length > 0 && (
        <ul className="app-list">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="app-item">
              <div className="app-info">
                <span className="app-name-row">
                  <WorkflowIcon key={workflow.iconPath ?? 'none'} path={workflow.iconPath} />
                  <span className="app-name">{workflow.name}</span>
                  {workflow.hotkey !== null && (
                    <span className="hotkey-badge">{workflow.hotkey}</span>
                  )}
                </span>
                <ol className="workflow-summary">
                  {workflow.actions.map((action, index) => (
                    <li key={index} className="workflow-summary-step">
                      <StepIcon action={action} />
                      <span>
                        {index + 1}. <StepLabel action={action} />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="app-actions">
                <button
                  type="button"
                  onClick={() => runWorkflow(workflow)}
                  disabled={running || busy}
                >
                  {running && runId === workflow.id ? 'Running…' : 'Run'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(workflow)
                    setCreating(false)
                    setStatus({ kind: 'idle' })
                  }}
                  disabled={running || busy}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeWorkflow(workflow)}
                  disabled={running || busy}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating || editing !== null ? (
        <WorkflowEditor
          initialName={editing?.name}
          initialIcon={editing?.iconPath ?? null}
          initialHotkey={editing?.hotkey ?? null}
          initialSteps={
            editing?.actions.map((action) => inputFromAction(action)) ?? []
          }
          submitLabel={editing === null ? 'Create workflow' : 'Save'}
          busy={busy || running}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(name, steps, iconPath, hotkey) =>
            save(editing?.id ?? null, name, steps, iconPath, hotkey)
          }
        />
      ) : (
        <button
          type="button"
          className="secondary"
          onClick={() => setCreating(true)}
          disabled={running || busy}
        >
          New workflow
        </button>
      )}

      {progress.kind !== 'idle' && (
        <div className="workflow-progress">
          {progress.kind === 'working' && (
            <p className={`status ${progressClass}`}>{progress.label}</p>
          )}
          {progress.kind !== 'working' && (
            <p className={`status ${progressClass}`}>{progress.message}</p>
          )}
          {running && (
            <button type="button" onClick={cancelRun} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      )}

      <ResultStatus result={status} />
    </div>
  )
}

export default Workflows
