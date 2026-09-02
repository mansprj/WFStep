import { useEffect, useRef, useState } from 'react'
import {
  describeMacroStep,
  keyName,
  macroDurationMs,
} from '@shared/macros'
import type { MacroButton, MacroStep, MacroPhase } from '@shared/macros'
import type { Macro } from '@shared/macros'
import type { Result } from '../result'
import ResultStatus from './ResultStatus'

type StepPatch =
  | { delayMs: number }
  | { x: number }
  | { y: number }
  | { button: MacroButton }
  | { count: number }
  | { amount: number }

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

function ButtonSelect({
  value,
  onChange,
  disabled,
}: {
  value: MacroButton
  onChange: (value: MacroButton) => void
  disabled: boolean
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as MacroButton)}
      disabled={disabled}
    >
      <option value="left">Left</option>
      <option value="right">Right</option>
      <option value="middle">Middle</option>
    </select>
  )
}

function StepRow({
  step,
  index,
  dragIndex,
  overIndex,
  busy,
  onChange,
  onRemove,
  onMove,
  onDragIndex,
  onOverIndex,
  onDragEnd,
}: {
  step: MacroStep
  index: number
  dragIndex: number | null
  overIndex: number | null
  busy: boolean
  onChange: (index: number, patch: StepPatch) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  onDragIndex: (index: number | null) => void
  onOverIndex: (index: number | null) => void
  onDragEnd: () => void
}) {
  const isDragging = dragIndex === index
  const isDropTarget = dragIndex !== null && overIndex === index && overIndex !== dragIndex
  const num = (patch: (value: number) => StepPatch) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value)
      if (!Number.isNaN(parsed)) {
        onChange(index, patch(parsed))
      }
    }

  return (
    <li
      className={`workflow-step${isDragging ? ' dragging' : ''}${isDropTarget ? ' drop-over' : ''}`}
      draggable={!busy}
      onDragStart={() => onDragIndex(index)}
      onDragOver={(event) => {
        if (dragIndex === null) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onOverIndex(index)
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (dragIndex !== null) {
          onMove(dragIndex, index)
        }
        onDragIndex(null)
        onOverIndex(null)
      }}
      onDragEnd={onDragEnd}
    >
      <div className="macro-step-head">
        <span className="workflow-step-grip" title="Drag to reorder">
          ⋮⋮
        </span>
        <span className="workflow-step-index">{index + 1}</span>
        <span className="macro-step-label">{describeMacroStep(step)}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={busy}
          title="Remove step"
        >
          ×
        </button>
      </div>

      <div className="macro-step-editor">
        <label className="macro-step-delay">
          <span>Wait</span>
          <input
            type="number"
            min="0"
            step="10"
            value={step.delayMs}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (!Number.isNaN(parsed)) {
                onChange(index, { delayMs: Math.max(0, parsed) })
              }
            }}
            disabled={busy}
          />
          <small>ms</small>
        </label>

        {step.type === 'mouseMove' && (
          <>
            <label className="macro-step-pair">
              <span>X</span>
              <input type="number" value={step.x} onChange={num((v) => ({ x: v }))} disabled={busy} />
            </label>
            <label className="macro-step-pair">
              <span>Y</span>
              <input type="number" value={step.y} onChange={num((v) => ({ y: v }))} disabled={busy} />
            </label>
          </>
        )}

        {(step.type === 'mouseDown' ||
          step.type === 'mouseUp' ||
          step.type === 'mouseClick') && (
          <>
            <label className="macro-step-pair">
              <span>X</span>
              <input type="number" value={step.x} onChange={num((v) => ({ x: v }))} disabled={busy} />
            </label>
            <label className="macro-step-pair">
              <span>Y</span>
              <input type="number" value={step.y} onChange={num((v) => ({ y: v }))} disabled={busy} />
            </label>
            <label className="macro-step-pair">
              <span>Btn</span>
              <ButtonSelect
                value={step.button}
                onChange={(button) => onChange(index, { button })}
                disabled={busy}
              />
            </label>
            {step.type === 'mouseClick' && (
              <label className="macro-step-pair">
                <span>×</span>
                <input
                  type="number"
                  min="1"
                  value={step.count}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (!Number.isNaN(parsed)) {
                      onChange(index, { count: Math.max(1, parsed) })
                    }
                  }}
                  disabled={busy}
                />
              </label>
            )}
          </>
        )}

        {step.type === 'mouseWheel' && (
          <>
            <label className="macro-step-pair">
              <span>Amount</span>
              <input
                type="number"
                value={step.amount}
                onChange={num((v) => ({ amount: v }))}
                disabled={busy}
              />
            </label>
          </>
        )}

        {(step.type === 'keyDown' || step.type === 'keyUp') && (
          <span className="macro-step-key-label">Key: {keyName(step.key)}</span>
        )}
      </div>
    </li>
  )
}

function StepList({
  steps,
  busy,
  onChange,
  onRemove,
  onMove,
}: {
  steps: MacroStep[]
  busy: boolean
  onChange: (index: number, patch: StepPatch) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <ul className="workflow-steps">
      {steps.map((step, index) => (
        <StepRow
          key={index}
          step={step}
          index={index}
          dragIndex={dragIndex}
          overIndex={overIndex}
          busy={busy}
          onChange={onChange}
          onRemove={onRemove}
          onMove={onMove}
          onDragIndex={setDragIndex}
          onOverIndex={setOverIndex}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
        />
      ))}
    </ul>
  )
}

export default function Macros() {
  const [macros, setMacros] = useState<Macro[]>([])
  const [pendingSteps, setPendingSteps] = useState<MacroStep[]>([])
  const [pendingName, setPendingName] = useState('')
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopCount, setLoopCount] = useState(1)
  const [status, setStatus] = useState<Result>({ kind: 'idle' })
  const [notice, setNotice] = useState<Result>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const prevPhase = useRef<MacroPhase>('idle')

  useEffect(() => {
    void window.api.macros.list().then(setMacros)
  }, [])

  useEffect(
    () =>
      window.api.macros.onState((state) => {
        setRecording(state.phase === 'recording')
        setPlaying(state.phase === 'playing')
        const wasRecording = prevPhase.current === 'recording'
        prevPhase.current = state.phase
        const stoppedRecording = wasRecording && state.phase === 'idle'
        if (stoppedRecording) {
          void window.api.macros.pendingSteps().then((steps) => {
            setPendingSteps(steps)
            setPendingName('')
          })
        }
      }),
    [],
  )

  useEffect(
    () =>
      window.api.macros.onNotice((message) =>
        setNotice(
          message.startsWith('Playing')
            ? { kind: 'working', label: message }
            : { kind: 'info', message },
        ),
      ),
    [],
  )

  const report = (outcome: { success: boolean; message: string }): void => {
    setStatus(
      outcome.success
        ? { kind: 'success', message: outcome.message }
        : { kind: 'error', message: outcome.message },
    )
  }

  const reload = async (): Promise<void> => {
    setMacros(await window.api.macros.list())
  }

  const startRecording = async (): Promise<void> => {
    setStatus({ kind: 'idle' })
    const outcome = await window.api.macros.recordStart()
    report(outcome)
    if (outcome.success) {
      setPendingSteps([])
      setPendingName('')
    }
  }

  const stopRecording = async (): Promise<void> => {
    const outcome = await window.api.macros.recordStop()
    report(outcome)
    if (outcome.success) {
      const steps = await window.api.macros.pendingSteps()
      setPendingSteps(steps)
    }
  }

  const discard = async (): Promise<void> => {
    await window.api.macros.recordDiscard()
    setPendingSteps([])
    setPendingName('')
  }

  const savePending = async (): Promise<void> => {
    const name = pendingName.trim()
    if (name.length === 0) {
      setStatus({ kind: 'error', message: 'Enter a macro name first.' })
      return
    }
    setBusy(true)
    const outcome = await window.api.macros.add({
      name,
      steps: pendingSteps,
      hotkey: null,
    })
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      setPendingSteps([])
      setPendingName('')
      await reload()
    }
  }

  const playSteps = async (steps: MacroStep[]): Promise<void> => {
    setStatus({ kind: 'idle' })
    setNotice({ kind: 'idle' })
    const config = {
      speed,
      loop: loopEnabled ? loopCount : 0,
    }
    const outcome = await window.api.macros.playStart(config, steps)
    report(outcome)
    if (outcome.success) {
      setPlaying(true)
    }
  }

  const stopPlayback = async (): Promise<void> => {
    await window.api.macros.playStop()
  }

  const removeMacro = async (macro: Macro): Promise<void> => {
    setBusy(true)
    const outcome = await window.api.macros.remove(macro.id)
    setBusy(false)
    report(outcome)
    if (outcome.success) {
      await reload()
    }
  }

  const patchStep = (index: number, patch: StepPatch): void => {
    setPendingSteps((current) =>
      current.map((step, i) =>
        i === index ? ({ ...step, ...patch } as MacroStep) : step,
      ),
    )
  }

  const removeStep = (index: number): void => {
    setPendingSteps((current) => current.filter((_, i) => i !== index))
  }

  const moveStep = (from: number, to: number): void => {
    setPendingSteps((current) => {
      if (from === to || to < 0 || to >= current.length) {
        return current
      }
      const next = [...current]
      const [step] = next.splice(from, 1)
      next.splice(to, 0, step)
      return next
    })
  }

  const hasPending = pendingSteps.length > 0

  return (
    <section className="field">
      <h2 className="field-title">Macros</h2>
      <p className="help">
        Record mouse and keyboard actions, then replay them with speed control
        and loops. Stop recording or playback with the configured hotkey
        (default <strong>F9</strong>) or the buttons.
      </p>

      <div className="macro-recorder">
        {!recording ? (
          <button type="button" onClick={startRecording} disabled={playing || busy}>
            ● Record
          </button>
        ) : (
          <>
            <button type="button" onClick={stopRecording} disabled={busy}>
              ■ Stop
            </button>
            <button type="button" onClick={discard} disabled={busy}>
              Discard
            </button>
          </>
        )}
        <button type="button" onClick={stopPlayback} disabled={!playing}>
          ⏹ Stop playback
        </button>
      </div>

      {recording && (
        <p className="status working">Recording… (press the stop hotkey to stop)</p>
      )}

      {notice.kind !== 'idle' && (
        <p className={`status ${notice.kind === 'working' ? 'working' : 'info'}`}>
          {notice.kind === 'working' ? notice.label : notice.message}
        </p>
      )}

      {hasPending && (
        <div className="macro-editor">
          <div className="macro-editor-head">
            <label htmlFor="macro-name">Macro name</label>
            <input
              id="macro-name"
              type="text"
              placeholder="e.g. Fill form, Sort desktop"
              value={pendingName}
              onChange={(event) => setPendingName(event.target.value)}
              disabled={busy}
            />
            </div>
            <p className="help">
              {pendingSteps.length} step{pendingSteps.length === 1 ? '' : 's'} ·
              about {formatDuration(macroDurationMs(pendingSteps))} · edit, remove
              or reorder steps below.
            </p>

            <StepList
              steps={pendingSteps}
              busy={busy}
              onChange={patchStep}
              onRemove={removeStep}
              onMove={moveStep}
            />

            <div className="actions">
              <button type="button" onClick={savePending} disabled={busy}>
                Save macro
              </button>
              <button type="button" onClick={discard} disabled={busy}>
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="macro-playback">
          <label className="macro-label-row">
            <span>Speed</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              disabled={playing || recording}
            />
            <span className="macro-value">{speed.toFixed(1)}×</span>
          </label>
          <label className="macro-label-row">
            <span>Loop</span>
            <input
              type="checkbox"
              checked={loopEnabled}
              onChange={(event) => setLoopEnabled(event.target.checked)}
              disabled={playing || recording}
            />
            <input
              type="number"
              value={loopCount}
              min="1"
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (!Number.isNaN(parsed)) {
                  setLoopCount(Math.max(1, parsed))
                }
              }}
              disabled={!loopEnabled || playing || recording}
              style={{ width: 64 }}
            />
            <span className="macro-value">times</span>
          </label>
        </div>

        {macros.length > 0 && (
          <ul className="app-list">
            {macros.map((macro) => (
              <li key={macro.id} className="app-item">
                <div className="app-info">
                  <span className="app-name">{macro.name}</span>
                  <span className="app-detail">
                    {macro.steps.length} step{macro.steps.length === 1 ? '' : 's'} ·{' '}
                    {formatDuration(macroDurationMs(macro.steps))}
                  </span>
                </div>
                <div className="app-actions">
                  <button
                    type="button"
                    onClick={() => playSteps(macro.steps)}
                    disabled={recording || busy}
                  >
                    Play
                  </button>
                  <button type="button" onClick={() => removeMacro(macro)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {macros.length === 0 && !hasPending && (
          <p className="help">No saved macros yet. Record one above.</p>
        )}

        <ResultStatus result={status} />
      </section>
  )
}
