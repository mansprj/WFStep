import { useEffect, useRef, useState } from 'react'
import {
  describeMacroStep,
  keyName,
  macroDurationMs,
} from '@shared/macros'
import type {
  MacroButton,
  MacroStep,
  MacroPhase,
  MousePathPoint,
} from '@shared/macros'
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
  | { points: MousePathPoint[] }

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
  rowIndex,
  dragIndex,
  overIndex,
  busy,
  onChange,
  onRemove,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow,
}: {
  step: MacroStep
  index: number
  rowIndex: number
  dragIndex: number | null
  overIndex: number | null
  busy: boolean
  onChange: (index: number, patch: StepPatch) => void
  onRemove: (index: number) => void
  onDragStartRow: (rowIndex: number) => void
  onDragOverRow: (rowIndex: number) => void
  onDropRow: (rowIndex: number) => void
  onDragEndRow: () => void
}) {
  const isDragging = dragIndex === rowIndex
  const isDropTarget =
    dragIndex !== null && overIndex === rowIndex && overIndex !== dragIndex
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
      onDragStart={() => onDragStartRow(rowIndex)}
      onDragOver={(event) => {
        if (dragIndex === null) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverRow(rowIndex)
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (dragIndex !== null) {
          onDropRow(rowIndex)
        }
      }}
      onDragEnd={onDragEndRow}
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

// A mouse movement shown in the editor as one collapsible row: either a single
// recorded mousePath step, or a run of consecutive raw mouseMove steps (old
// recordings). `points` map back to the raw steps so edits stay simple.
interface PathPointRef {
  stepIndex: number
  pointIndex: number
  x: number
  y: number
  delayMs: number
}

type Row =
  | { kind: 'single'; index: number }
  | { kind: 'path'; start: number; count: number; durationMs: number; points: PathPointRef[] }

function buildRows(steps: MacroStep[]): Row[] {
  const rows: Row[] = []
  let i = 0
  while (i < steps.length) {
    const step = steps[i]
    if (step.type === 'mousePath') {
      rows.push({
        kind: 'path',
        start: i,
        count: 1,
        durationMs: step.delayMs + step.points.reduce((s, p) => s + p.delayMs, 0),
        points: step.points.map((p, j) => ({
          stepIndex: i,
          pointIndex: j,
          x: p.x,
          y: p.y,
          delayMs: p.delayMs,
        })),
      })
      i++
    } else if (step.type === 'mouseMove') {
      let j = i
      let durationMs = 0
      const points: PathPointRef[] = []
      while (j < steps.length && steps[j].type === 'mouseMove') {
        const move = steps[j] as { x: number; y: number; delayMs: number }
        durationMs += move.delayMs
        points.push({
          stepIndex: j,
          pointIndex: j - i,
          x: move.x,
          y: move.y,
          delayMs: move.delayMs,
        })
        j++
      }
      rows.push({ kind: 'path', start: i, count: j - i, durationMs, points })
      i = j
    } else {
      rows.push({ kind: 'single', index: i })
      i++
    }
  }
  return rows
}

function PathRow({
  row,
  rowIndex,
  expanded,
  dragIndex,
  overIndex,
  busy,
  onToggleExpand,
  onPatchPoint,
  onRemovePoint,
  onRemoveRow,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow,
}: {
  row: Extract<Row, { kind: 'path' }>
  rowIndex: number
  expanded: boolean
  dragIndex: number | null
  overIndex: number | null
  busy: boolean
  onToggleExpand: (rowIndex: number) => void
  onPatchPoint: (
    ref: PathPointRef,
    patch: Partial<Omit<PathPointRef, 'stepIndex' | 'pointIndex'>>,
  ) => void
  onRemovePoint: (ref: PathPointRef) => void
  onRemoveRow: (row: Extract<Row, { kind: 'path' }>) => void
  onDragStartRow: (rowIndex: number) => void
  onDragOverRow: (rowIndex: number) => void
  onDropRow: (rowIndex: number) => void
  onDragEndRow: () => void
}) {
  const first = row.points.length > 0 ? row.points[0] : null
  const label =
    row.points.length > 0 && first !== null
      ? `Move (${row.points.length} points)`
      : 'Move'
  const isDragging = dragIndex === rowIndex
  const isDropTarget =
    dragIndex !== null && overIndex === rowIndex && overIndex !== dragIndex

  return (
    <li
      className={`workflow-step path-row${isDragging ? ' dragging' : ''}${isDropTarget ? ' drop-over' : ''}`}
      draggable={!busy}
      onDragStart={() => onDragStartRow(rowIndex)}
      onDragOver={(event) => {
        if (dragIndex === null) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverRow(rowIndex)
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (dragIndex !== null) {
          onDropRow(rowIndex)
        }
      }}
      onDragEnd={onDragEndRow}
    >
      <div className="macro-step-head">
        <span className="workflow-step-grip" title="Drag to reorder">
          ⋮⋮
        </span>
        <span className="workflow-step-index">{row.start + 1}</span>
        <span className="macro-step-label">{label}</span>
        <span className="macro-step-duration">{formatDuration(row.durationMs)}</span>
        <button
          type="button"
          className="macro-step-toggle"
          onClick={() => onToggleExpand(rowIndex)}
          disabled={busy}
          title={expanded ? 'Collapse points' : 'Show points'}
        >
          {expanded ? '−' : '+'}
        </button>
        <button
          type="button"
          onClick={() => onRemoveRow(row)}
          disabled={busy}
          title="Remove movement"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="path-row-points">
          {row.points.map((point, pointIndex) => (
            <div className="path-row-point" key={point.stepIndex}>
              <label className="macro-step-pair">
                <span>X</span>
                <input
                  type="number"
                  value={point.x}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (!Number.isNaN(parsed)) {
                      onPatchPoint(point, { x: parsed })
                    }
                  }}
                  disabled={busy}
                />
              </label>
              <label className="macro-step-pair">
                <span>Y</span>
                <input
                  type="number"
                  value={point.y}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (!Number.isNaN(parsed)) {
                      onPatchPoint(point, { y: parsed })
                    }
                  }}
                  disabled={busy}
                />
              </label>
              <label className="macro-step-pair">
                <span>Wait</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={point.delayMs}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (!Number.isNaN(parsed)) {
                      onPatchPoint(point, { delayMs: Math.max(0, parsed) })
                    }
                  }}
                  disabled={busy}
                />
                <small>ms</small>
              </label>
              <button
                type="button"
                className="path-row-point-remove"
                onClick={() => onRemovePoint(point)}
                disabled={busy || row.points.length <= 1}
                title="Remove point"
              >
                ×
              </button>
              <span className="path-row-point-index">{pointIndex + 1}</span>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

function StepList({
  steps,
  busy,
  onChange,
  onRemove,
  onMove,
  onMoveSpan,
}: {
  steps: MacroStep[]
  busy: boolean
  onChange: (index: number, patch: StepPatch) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  onMoveSpan: (from: number, count: number, to: number) => void
}) {
  const rows = buildRows(steps)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<number[]>([])

  const toggleExpand = (rowIndex: number): void => {
    setExpanded((current) =>
      current.includes(rowIndex)
        ? current.filter((i) => i !== rowIndex)
        : [...current, rowIndex],
    )
  }
  const isExpanded = (rowIndex: number): boolean => expanded.includes(rowIndex)

  // Removes every raw step covered by the given row.
  const removeRow = (row: Row): void => {
    const start = row.kind === 'path' ? row.start : row.index
    const count = row.kind === 'path' ? row.count : 1
    for (let k = start + count - 1; k >= start; k--) {
      onRemove(k)
    }
  }

  const onDropEnd = (from: number, to: number): void => {
    const fromRow = rows[from]
    const toRow = rows[to]
    if (fromRow === undefined) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const fromStart = fromRow.kind === 'path' ? fromRow.start : fromRow.index
    const toStart =
      toRow === undefined
        ? steps.length
        : toRow.kind === 'path'
          ? toRow.start
          : toRow.index
    if (toStart === fromStart) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    if (fromRow.kind === 'path') {
      onMoveSpan(fromRow.start, fromRow.count, toStart)
    } else {
      onMove(fromRow.index, toStart)
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  const patchPoint = (
    ref: PathPointRef,
    patch: Partial<Omit<PathPointRef, 'stepIndex' | 'pointIndex'>>,
  ): void => {
    const target = steps[ref.stepIndex]
    if (target === undefined) {
      return
    }
    const stepPatch: StepPatch =
      patch.x !== undefined
        ? { x: patch.x }
        : patch.y !== undefined
          ? { y: patch.y }
          : { delayMs: patch.delayMs ?? 0 }
    if (target.type === 'mouseMove') {
      onChange(ref.stepIndex, stepPatch)
    } else if (target.type === 'mousePath') {
      onChange(ref.stepIndex, {
        points: target.points.map((p, j) => (j === ref.pointIndex ? { ...p, ...patch } : p)),
      })
    }
  }

  const removePoint = (ref: PathPointRef): void => {
    const target = steps[ref.stepIndex]
    if (target === undefined) {
      return
    }
    if (target.type === 'mouseMove') {
      onRemove(ref.stepIndex)
    } else if (target.type === 'mousePath' && target.points.length > 1) {
      onChange(ref.stepIndex, {
        points: target.points.filter((_, j) => j !== ref.pointIndex),
      })
    }
  }

  return (
    <ul className="workflow-steps">
      {rows.map((row, rowIndex) =>
        row.kind === 'single' ? (
          <StepRow
            key={row.index}
            step={steps[row.index]}
            index={row.index}
            rowIndex={rowIndex}
            dragIndex={dragIndex}
            overIndex={overIndex}
            busy={busy}
            onChange={onChange}
            onRemove={onRemove}
            onDragStartRow={setDragIndex}
            onDragOverRow={setOverIndex}
            onDropRow={(to) => {
              setDragIndex(null)
              if (dragIndex !== null) {
                onDropEnd(dragIndex, to)
              }
              setOverIndex(null)
            }}
            onDragEndRow={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
          />
        ) : (
          <PathRow
            key={`path-${row.start}`}
            row={row}
            rowIndex={rowIndex}
            expanded={isExpanded(rowIndex)}
            dragIndex={dragIndex}
            overIndex={overIndex}
            busy={busy}
            onToggleExpand={toggleExpand}
            onPatchPoint={patchPoint}
            onRemovePoint={removePoint}
            onRemoveRow={removeRow}
            onDragStartRow={setDragIndex}
            onDragOverRow={setOverIndex}
            onDropRow={(to) => {
              setDragIndex(null)
              if (dragIndex !== null) {
                onDropEnd(dragIndex, to)
              }
              setOverIndex(null)
            }}
            onDragEndRow={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
          />
        )
      )}
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

  const moveSpan = (from: number, count: number, to: number): void => {
    setPendingSteps((current) => {
      if (from === to || count <= 0 || to < 0 || to > current.length) {
        return current
      }
      const next = [...current]
      const span = next.splice(from, count)
      const insertAt = to > from ? to - count : to
      next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, ...span)
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
              onMoveSpan={moveSpan}
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
