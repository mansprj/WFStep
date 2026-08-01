import { useEffect, useState } from 'react'
import type { Workflow } from '@shared/workflows'
import {
  actionFromInput,
  inputFromAction,
  KIND_LABELS,
  KIND_PLACEHOLDERS,
  type ActionKind,
} from '../actionForm'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

interface StepRow {
  kind: ActionKind
  value: string
}

interface WorkflowEditorProps {
  initialName?: string
  initialSteps?: StepRow[]
  submitLabel: string
  busy: boolean
  onCancel?: () => void
  onSubmit: (name: string, steps: StepRow[]) => Promise<boolean>
}

function WorkflowEditor({
  initialName = '',
  initialSteps = [],
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: WorkflowEditorProps) {
  const [name, setName] = useState(initialName)
  const [steps, setSteps] = useState<StepRow[]>(initialSteps)

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

  const browse = async (index: number): Promise<void> => {
    const path = await window.api.dialogs.selectExecutable()
    if (path !== null) {
      updateStep(index, { value: path })
    }
  }

  const submit = async (): Promise<void> => {
    if (await onSubmit(name, steps)) {
      setName('')
      setSteps([])
    }
  }

  return (
    <div className="workflow-editor">
      <label htmlFor="workflow-name">Workflow name</label>
      <input
        id="workflow-name"
        type="text"
        placeholder="Restart Discord & start Steam"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />

      <ul className="workflow-steps">
        {steps.map((step, index) => (
          <li key={index} className="workflow-step">
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
            <input
              type="text"
              placeholder={KIND_PLACEHOLDERS[step.kind]}
              value={step.value}
              onChange={(event) => updateStep(index, { value: event.target.value })}
              disabled={busy}
            />
            {step.kind === 'start' && (
              <button
                type="button"
                className="workflow-browse"
                onClick={() => browse(index)}
                disabled={busy}
                title="Browse for executable"
              >
                Browse…
              </button>
            )}
            <button
              type="button"
              onClick={() => removeStep(index)}
              disabled={busy}
              title="Remove step"
            >
              ×
            </button>
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
  ): Promise<boolean> => {
    const actions = steps
      .filter((step) => step.value.trim().length > 0)
      .map((step) => actionFromInput(step.kind, step.value))

    setBusy(true)
    const outcome =
      id === null
        ? await window.api.workflows.add({ name, actions })
        : await window.api.workflows.update(id, { name, actions })
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
                <span className="app-name">{workflow.name}</span>
                <span className="app-detail">
                  {workflow.actions.length} step
                  {workflow.actions.length === 1 ? '' : 's'}
                </span>
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
          initialSteps={
            editing?.actions.map((action) => inputFromAction(action)) ?? []
          }
          submitLabel={editing === null ? 'Create workflow' : 'Save'}
          busy={busy || running}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(name, steps) => save(editing?.id ?? null, name, steps)}
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
