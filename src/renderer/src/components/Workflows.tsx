import { useEffect, useState } from 'react'
import { describeActionShort } from '@shared/actions'
import type { AutomationAction } from '@shared/actions'
import { isVariableName } from '@shared/variables'
import type { Workflow, WorkflowInput } from '@shared/workflows'
import {
  describeSchedule,
  MAX_INTERVAL_MINUTES,
  nextRunAt,
  WEEKDAY_SHORT,
  type Weekday,
  type WorkflowSchedule,
} from '@shared/schedules'
import {
  actionFromInput,
  emptyExtras,
  inputFromAction,
  KIND_LABELS,
  KIND_PLACEHOLDERS,
  type ActionExtras,
  type ActionKind,
} from '../actionForm'
import type { Result } from '../result'
import ActionIcon from './ActionIcon'
import ResultStatus from './ResultStatus'
import HotkeyField from './HotkeyField'

interface StepRow {
  kind: ActionKind
  value: string
  extras: ActionExtras
}

function displayName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.exe$/i, '')
}

// Friendly "next run" hint for the deterministic triggers (interval / time).
function nextRunIn(workflow: Workflow): string | null {
  let best: number | null = null
  for (const schedule of workflow.schedules) {
    const next = nextRunAt(schedule)
    if (next === null) {
      continue
    }
    const ms = next.getTime() - Date.now()
    if (best === null || ms < best) {
      best = ms
    }
  }
  if (best === null) {
    return null
  }
  if (best < 60_000) {
    return 'in <1 min'
  }
  if (best < 3_600_000) {
    return `in ${Math.ceil(best / 60_000)} min`
  }
  if (best < 86_400_000) {
    return `in ${Math.ceil(best / 3_600_000)} h`
  }
  return new Date(Date.now() + best).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function scheduleBadges(workflow: Workflow) {
  return workflow.schedules.map((schedule, index) => (
    <span key={index} className="schedule-badge">
      {describeSchedule(schedule)}
    </span>
  ))
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
  initialSchedules?: WorkflowSchedule[]
  submitLabel: string
  busy: boolean
  onCancel?: () => void
  onSubmit: (
    name: string,
    steps: StepRow[],
    iconPath: string | null,
    hotkey: string | null,
    schedules: WorkflowSchedule[],
  ) => Promise<boolean>
}

function WorkflowEditor({
  initialName = '',
  initialSteps = [],
  initialIcon = null,
  initialHotkey = null,
  initialSchedules = [],
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: WorkflowEditorProps) {
  const [name, setName] = useState(initialName)
  const [steps, setSteps] = useState<StepRow[]>(initialSteps)
  const [iconPath, setIconPath] = useState<string | null>(initialIcon)
  const [hotkey, setHotkey] = useState<string | null>(initialHotkey)
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>(initialSchedules)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [past, setPast] = useState<StepRow[][]>([])
  const [future, setFuture] = useState<StepRow[][]>([])

  // Programs referenced by "Start process" steps, offered as shortcuts when
  // adding Stop/Restart steps so the same path is reused.
  const startPaths = [
    ...new Set(
      steps
        .filter((step) => step.kind === 'start' && step.value.trim().length > 0)
        .map((step) => step.value.trim()),
    ),
  ]

  const commit = (next: StepRow[]): void => {
    setPast((current) => [steps, ...current].slice(0, 100))
    setFuture([])
    setSteps(next)
  }

  const undo = (): void => {
    if (past.length === 0) {
      return
    }
    const [previous, ...rest] = past
    setPast(rest)
    setFuture((current) => [steps, ...current].slice(0, 100))
    setSteps(previous)
  }

  const redo = (): void => {
    if (future.length === 0) {
      return
    }
    const [nextState, ...rest] = future
    setFuture(rest)
    setPast((current) => [steps, ...current].slice(0, 100))
    setSteps(nextState)
  }

  const onEditorKeyDown = (event: React.KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey)) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    } else if (key === 'y') {
      event.preventDefault()
      redo()
    }
  }

  const updateStep = (index: number, patch: Partial<StepRow>): void => {
    commit(
      steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    )
  }

  const addStep = (): void => {
    commit([...steps, { kind: 'start', value: '', extras: emptyExtras() }])
  }

  const removeStep = (index: number): void => {
    commit(steps.filter((_, i) => i !== index))
  }

  const reorderStep = (from: number, to: number): void => {
    if (from === to || to < 0 || to >= steps.length) {
      return
    }
    const next = [...steps]
    const [step] = next.splice(from, 1)
    next.splice(to, 0, step)
    commit(next)
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

  const pickWindow = async (index: number): Promise<void> => {
    const step = steps[index]
    const wins = await window.api.windows.list()
    if (wins.length === 0) {
      window.alert('No open windows found.')
      return
    }
    const list = wins
      .map((w, i) => `${i + 1}. ${w.title}  [${w.process}]`)
      .join('\n')
    const input = window.prompt(
      `Open windows (enter a number or type a name):\n\n${list}`,
    )
    if (input === null) {
      return
    }
    const text = input.trim()
    const num = Number(text)
    let value = ''
    if (Number.isInteger(num) && num >= 1 && num <= wins.length) {
      value = wins[num - 1].title || wins[num - 1].process
    } else if (text.length > 0) {
      value = text
    }
    if (value.length === 0) {
      return
    }
    if (step.kind === 'clickText') {
      updateStep(index, { extras: { ...step.extras, window: value } })
    } else {
      updateStep(index, { value })
    }
  }

  const chooseIcon = async (): Promise<void> => {
    const path = await window.api.dialogs.selectImage()
    if (path !== null) {
      setIconPath(path)
    }
  }

  const submit = async (): Promise<void> => {
    if (await onSubmit(name, steps, iconPath, hotkey, schedules)) {
      setName('')
      setSteps([])
      setIconPath(null)
      setHotkey(null)
      setSchedules([])
    }
  }

  return (
    <div
      className="workflow-editor"
      onKeyDown={onEditorKeyDown}
    >
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
        shortcut works while WF Step runs in the tray.
      </p>

      <label>Schedule (optional)</label>
      <ScheduleEditor
        schedules={schedules}
        onChange={setSchedules}
        busy={busy}
      />
      <p className="schedule-hint">
        Interval and time schedules use your system clock. File watches and
        clipboard triggers only fire while WF Step is running.
      </p>

      <ul className="workflow-steps">
        {steps.map((step, index) => {
          const isDragging = dragIndex === index
          const isDropTarget =
            dragIndex !== null && overIndex === index && overIndex !== dragIndex
          return (
            <li
              key={index}
              className={`workflow-step${isDragging ? ' dragging' : ''}${isDropTarget ? ' drop-over' : ''}`}
              draggable={!busy}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => {
                if (dragIndex === null) {
                  return
                }
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOverIndex(index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null) {
                  reorderStep(dragIndex, index)
                }
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
            >
              <div className="workflow-step-head">
                <span
                  className="workflow-step-grip"
                  title={busy ? undefined : 'Drag to reorder'}
                >
                  ⋮⋮
                </span>
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
              {(step.kind === 'activateWindow' ||
                step.kind === 'waitForWindow' ||
                step.kind === 'clickText' ||
                step.kind === 'ifWindowExists' ||
                step.kind === 'ifWindowMissing') && (
                <button
                  type="button"
                  className="workflow-browse"
                  onClick={() => pickWindow(index)}
                  disabled={busy}
                  title="Pick from open windows"
                >
                  Window…
                </button>
              )}
            </div>
            {(step.kind === 'ifWindowExists' ||
              step.kind === 'ifWindowMissing' ||
              step.kind === 'ifProcessRunning' ||
              step.kind === 'ifProcessStopped' ||
              step.kind === 'waitForWindow' ||
              step.kind === 'clickText' ||
              step.kind === 'setVariable') && (
              <div className="input-row step-extra">
                {(step.kind === 'ifWindowExists' ||
                  step.kind === 'ifWindowMissing' ||
                  step.kind === 'ifProcessRunning' ||
                  step.kind === 'ifProcessStopped') && (
                  <label className="step-extra-field">
                    Skip next
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={step.extras.skipOnFail}
                      onChange={(event) =>
                        updateStep(index, {
                          extras: {
                            ...step.extras,
                            skipOnFail: Math.max(
                              0,
                              Math.min(50, Number(event.target.value) || 0),
                            ),
                          },
                        })
                      }
                      disabled={busy}
                    />
                    steps if the condition fails (0 = stop the workflow)
                  </label>
                )}
                {step.kind === 'clickText' && (
                  <label className="step-extra-field">
                    Window
                    <input
                      type="text"
                      placeholder="Window title or program"
                      value={step.extras.window}
                      onChange={(event) =>
                        updateStep(index, {
                          extras: { ...step.extras, window: event.target.value },
                        })
                      }
                      disabled={busy}
                    />
                  </label>
                )}
                {step.kind === 'setVariable' && (
                  <label className="step-extra-field">
                    Value
                    <input
                      type="text"
                      placeholder="Value — may use ${name} references"
                      value={step.extras.variableValue}
                      onChange={(event) =>
                        updateStep(index, {
                          extras: {
                            ...step.extras,
                            variableValue: event.target.value,
                          },
                        })
                      }
                      disabled={busy}
                    />
                  </label>
                )}
                {(step.kind === 'waitForWindow' ||
                  step.kind === 'clickText') && (
                  <label className="step-extra-field">
                    Timeout
                    <input
                      type="number"
                      min={0}
                      value={step.extras.timeoutMs}
                      onChange={(event) =>
                        updateStep(index, {
                          extras: {
                            ...step.extras,
                            timeoutMs: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          },
                        })
                      }
                      disabled={busy}
                    />
                    ms
                  </label>
                )}
              </div>
            )}
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
          )
        })}
      </ul>

      <div className="actions">
        <button type="button" onClick={addStep} disabled={busy}>
          Add step
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={busy || past.length === 0}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={busy || future.length === 0}
          title="Redo (Ctrl+Y)"
        >
          Redo
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

function ScheduleEditor({
  schedules,
  onChange,
  busy,
}: {
  schedules: WorkflowSchedule[]
  onChange: (schedules: WorkflowSchedule[]) => void
  busy: boolean
}) {
  const [minutes, setMinutes] = useState('30')
  const [time, setTime] = useState('09:00')
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5])
  const [watchPath, setWatchPath] = useState('')
  const [pattern, setPattern] = useState('')

  const toggleDay = (day: Weekday): void => {
    setDays(
      days.includes(day)
        ? days.filter((other) => other !== day)
        : [...days, day].sort((a, b) => a - b),
    )
  }

  const add = (schedule: WorkflowSchedule): void => {
    onChange([...schedules, schedule])
  }

  const addInterval = (): void => {
    const value = Math.round(Number(minutes))
    if (!Number.isInteger(value) || value < 1 || value > MAX_INTERVAL_MINUTES) {
      window.alert(`Interval must be between 1 and ${MAX_INTERVAL_MINUTES} minutes.`)
      return
    }
    add({ kind: 'interval', minutes: value })
  }

  const addTime = (): void => {
    if (days.length === 0) {
      window.alert('Pick at least one weekday.')
      return
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      window.alert('Time must look like 09:00.')
      return
    }
    add({ kind: 'time', days, time })
  }

  const addWatch = (): void => {
    const path = watchPath.trim()
    if (path.length === 0) {
      window.alert('Enter a file or folder path to watch.')
      return
    }
    add({ kind: 'fileWatch', path })
    setWatchPath('')
  }

  const addClipboard = (): void => {
    const value = pattern.trim()
    if (value.length === 0) {
      window.alert('Enter a text or pattern to match against.')
      return
    }
    add({ kind: 'clipboard', pattern: value })
    setPattern('')
  }

  const browseFolder = async (): Promise<void> => {
    const path = await window.api.dialogs.selectFolder()
    if (path !== null) {
      setWatchPath(path)
    }
  }

  return (
    <div className="schedule-editor">
      <div className="schedule-row">
        <span className="schedule-row-label">Every</span>
        <input
          className="schedule-number"
          type="number"
          min={1}
          max={MAX_INTERVAL_MINUTES}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          disabled={busy}
        />
        <span className="schedule-row-label">minutes</span>
        <button type="button" onClick={addInterval} disabled={busy}>
          Add
        </button>
      </div>

      <div className="schedule-row">
        <span className="schedule-row-label">At</span>
        <input
          className="schedule-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          disabled={busy}
        />
        <span className="schedule-days">
          {WEEKDAY_SHORT.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`day-toggle${days.includes(index as Weekday) ? ' active' : ''}`}
              onClick={() => toggleDay(index as Weekday)}
              disabled={busy}
            >
              {label}
            </button>
          ))}
        </span>
        <button type="button" onClick={addTime} disabled={busy}>
          Add
        </button>
      </div>

      <div className="schedule-row">
        <label className="schedule-startup-toggle">
          <input
            type="checkbox"
            checked={schedules.some((schedule) => schedule.kind === 'startup')}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...schedules, { kind: 'startup' }]
                  : schedules.filter((schedule) => schedule.kind !== 'startup'),
              )
            }
            disabled={busy}
          />
          Run when the app starts
        </label>
      </div>

      <div className="schedule-row">
        <span className="schedule-row-label">Watch</span>
        <input
          type="text"
          placeholder="File or folder path"
          value={watchPath}
          onChange={(event) => setWatchPath(event.target.value)}
          disabled={busy}
        />
        <button type="button" onClick={browseFolder} disabled={busy}>
          Browse…
        </button>
        <button type="button" onClick={addWatch} disabled={busy}>
          Add
        </button>
      </div>

      <div className="schedule-row">
        <span className="schedule-row-label">Clipboard matches</span>
        <input
          type="text"
          placeholder="Text or regular expression"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          disabled={busy}
        />
        <button type="button" onClick={addClipboard} disabled={busy}>
          Add
        </button>
      </div>

      {schedules.length > 0 && (
        <ul className="schedule-list">
          {schedules.map((schedule, index) => (
            <li key={index} className="schedule-item">
              <span className="schedule-item-label">
                {describeSchedule(schedule)}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange(schedules.filter((_, other) => other !== index))
                }
                disabled={busy}
                title="Remove schedule"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
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
    schedules: WorkflowSchedule[],
  ): Promise<boolean> => {
    for (const step of steps) {
      if (
        step.kind === 'setVariable' &&
        !isVariableName(step.value.trim())
      ) {
        setStatus({
          kind: 'error',
          message: `"${step.value.trim()}" is not a valid variable name. Use letters, digits, "_" or "-", starting with a letter.`,
        })
        return false
      }
    }
    const actions = steps
      .filter((step) => step.value.trim().length > 0)
      .map((step) => actionFromInput(step.kind, step.value, step.extras))

    setBusy(true)
    const outcome =
      id === null
        ? await window.api.workflows.add({
            name,
            actions,
            iconPath,
            hotkey,
            schedules,
          })
        : await window.api.workflows.update(id, {
            name,
            actions,
            iconPath,
            hotkey,
            schedules,
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

  const exportWorkflow = async (workflow: Workflow): Promise<void> => {
    const input: WorkflowInput = {
      name: workflow.name,
      actions: workflow.actions,
      iconPath: workflow.iconPath,
      hotkey: workflow.hotkey,
      schedules: workflow.schedules,
    }
    report(await window.api.workflows.export(input))
  }

  const importWorkflow = async (): Promise<void> => {
    const imported = await window.api.workflows.import()
    if (!imported.success || imported.input === undefined) {
      setStatus({ kind: 'error', message: imported.message })
      return
    }
    const outcome = await window.api.workflows.add(imported.input)
    report(outcome)
    if (outcome.success) {
      await reload()
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
                  {scheduleBadges(workflow)}
                  {nextRunIn(workflow) !== null && (
                    <span className="next-run-badge">
                      next {nextRunIn(workflow)}
                    </span>
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
                  onClick={() => exportWorkflow(workflow)}
                  disabled={running || busy}
                  title="Save this workflow as a JSON file"
                >
                  Export
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
          initialSchedules={editing?.schedules ?? []}
          initialSteps={
            editing?.actions.map((action) => {
              const input = inputFromAction(action)
              return { kind: input.kind, value: input.value, extras: input.extras }
            }) ?? []
          }
          submitLabel={editing === null ? 'Create workflow' : 'Save'}
          busy={busy || running}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(name, steps, iconPath, hotkey, schedules) =>
            save(editing?.id ?? null, name, steps, iconPath, hotkey, schedules)
          }
        />
      ) : (
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setCreating(true)}
            disabled={running || busy}
          >
            New workflow
          </button>
          <button
            type="button"
            onClick={importWorkflow}
            disabled={running || busy}
            title="Load a workflow from a JSON file"
          >
            Import JSON
          </button>
        </div>
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
