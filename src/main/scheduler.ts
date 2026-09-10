import { clipboard } from 'electron'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { listWorkflows } from './workflowsManager'
import { isWorkflowRunning, startWorkflowRun } from './workflowRunner'
import { logEvent } from './logManager'
import { describeSchedule, nextRunAt } from '@shared/schedules'
import type { WorkflowSchedule } from '@shared/schedules'
import type { Workflow } from '@shared/workflows'

const STARTUP_DELAY_MS = 8000
const FILE_DEBOUNCE_MS = 1500
const FILE_COOLDOWN_MS = 10_000
const CLIPBOARD_POLL_MS = 750

const timers = new Set<NodeJS.Timeout>()
const watchers = new Map<string, FSWatcher>()
const fileCooldowns = new Map<string, number>()
const fileDebounces = new Map<string, NodeJS.Timeout>()
let clipboardTimer: NodeJS.Timeout | null = null
let lastClipboard = ''

function fire(workflow: Workflow, trigger: string): void {
  if (isWorkflowRunning()) {
    logEvent({
      source: 'workflow',
      context: workflow.name,
      actionType: 'schedule',
      success: false,
      message: `Skipped scheduled run (${trigger}): another workflow is running.`,
    })
    return
  }
  logEvent({
    source: 'workflow',
    context: workflow.name,
    actionType: 'schedule',
    success: true,
    message: `Scheduled run triggered (${trigger}).`,
  })
  void startWorkflowRun(workflow)
}

// One-shot timer at the next wall-clock boundary. Also computes the run after
// the upcoming one up front, so the schedule stays aligned to the clock even
// when the current firing is skipped/cancelled by a running workflow.
function scheduleNext(workflow: Workflow, schedule: WorkflowSchedule): void {
  const next = nextRunAt(schedule)
  if (next === null) {
    return
  }
  const after = nextRunAt(schedule, new Date(next.getTime() + 1000))
  const delay = Math.max(500, next.getTime() - Date.now())
  const timer = setTimeout(() => {
    timers.delete(timer)
    fire(workflow, describeSchedule(schedule))
    if (after !== null) {
      scheduleAt(workflow, schedule, after)
    }
  }, delay)
  timers.add(timer)
}

function scheduleAt(workflow: Workflow, schedule: WorkflowSchedule, when: Date): void {
  const delay = Math.max(500, when.getTime() - Date.now())
  const timer = setTimeout(() => {
    timers.delete(timer)
    fire(workflow, describeSchedule(schedule))
    const nextRun = nextRunAt(schedule, new Date(when.getTime() + 1000))
    if (nextRun !== null) {
      scheduleAt(workflow, schedule, nextRun)
    }
  }, delay)
  timers.add(timer)
}

function scheduleStartup(workflow: Workflow): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    fire(workflow, 'app start')
  }, STARTUP_DELAY_MS)
  timers.add(timer)
}

function scheduleFileWatch(workflow: Workflow, schedule: WorkflowSchedule): void {
  if (schedule.kind !== 'fileWatch') {
    return
  }
  const key = `${workflow.id}::${schedule.path}`
  try {
    const watcher = watch(schedule.path, { persistent: true }, () => {
      const now = Date.now()
      const last = fileCooldowns.get(key) ?? 0
      if (now - last < FILE_COOLDOWN_MS) {
        return
      }
      fileCooldowns.set(key, now)
      const existing = fileDebounces.get(key)
      if (existing !== undefined) {
        clearTimeout(existing)
      }
      const debounce = setTimeout(() => {
        fileDebounces.delete(key)
        fire(workflow, describeSchedule(schedule))
      }, FILE_DEBOUNCE_MS)
      fileDebounces.set(key, debounce)
    })
    watchers.set(key, watcher)
  } catch {
    logEvent({
      source: 'workflow',
      context: workflow.name,
      actionType: 'schedule',
      success: false,
      message: `Cannot watch "${schedule.path}": path not available.`,
    })
  }
}

function patternMatches(text: string, pattern: string): boolean {
  if (text.length === 0) {
    return false
  }
  try {
    return new RegExp(pattern).test(text)
  } catch {
    return text.includes(pattern)
  }
}

// Polls the clipboard every tick. Fires a workflow when a freshly copied text
// matches one of its clipboard patterns — once per distinct piece of text.
function scheduleClipboard(): void {
  if (clipboardTimer !== null) {
    return
  }
  clipboardTimer = setInterval(() => {
    let text: string
    try {
      text = clipboard.readText()
    } catch {
      return
    }
    text = text.trim()
    if (text.length === 0 || text === lastClipboard) {
      return
    }
    lastClipboard = text
    for (const workflow of listWorkflows()) {
      for (const schedule of workflow.schedules) {
        if (
          schedule.kind === 'clipboard' &&
          patternMatches(text, schedule.pattern)
        ) {
          fire(workflow, `clipboard “${schedule.pattern}”`)
        }
      }
    }
  }, CLIPBOARD_POLL_MS)
}

// `includeStartup` is true only when called from app boot; editing a workflow's
// schedules in the UI should not re-fire "on app start" triggers.
export function refreshSchedules(includeStartup = false): void {
  clearSchedules()
  for (const workflow of listWorkflows()) {
    for (const schedule of workflow.schedules) {
      switch (schedule.kind) {
        case 'interval':
        case 'time':
          scheduleNext(workflow, schedule)
          break
        case 'startup':
          if (includeStartup) {
            scheduleStartup(workflow)
          }
          break
        case 'fileWatch':
          scheduleFileWatch(workflow, schedule)
          break
        case 'clipboard':
          break
      }
    }
  }
  scheduleClipboard()
}

export function clearSchedules(): void {
  for (const timer of timers) {
    clearTimeout(timer)
  }
  timers.clear()
  for (const debounce of fileDebounces.values()) {
    clearTimeout(debounce)
  }
  fileDebounces.clear()
  fileCooldowns.clear()
  for (const watcher of watchers.values()) {
    watcher.close()
  }
  watchers.clear()
  if (clipboardTimer !== null) {
    clearInterval(clipboardTimer)
    clipboardTimer = null
  }
  lastClipboard = ''
}