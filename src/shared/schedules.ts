// Scheduler triggers attached to workflows. As few moving parts as possible:
// the main process only needs the types + the "next run" arithmetic, and the
// renderer reuses the same math to show a "next run" hint in the workflow list.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type WorkflowSchedule =
  | { kind: 'interval'; minutes: number }
  | { kind: 'time'; days: Weekday[]; time: string }
  | { kind: 'startup' }
  | { kind: 'fileWatch'; path: string }
  | { kind: 'clipboard'; pattern: string }

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const MAX_INTERVAL_MINUTES = 7 * 24 * 60

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidWorkflowSchedule(value: unknown): value is WorkflowSchedule {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  switch (record.kind) {
    case 'interval':
      return (
        Number.isInteger(record.minutes) &&
        (record.minutes as number) >= 1 &&
        (record.minutes as number) <= MAX_INTERVAL_MINUTES
      )
    case 'time': {
      if (!Array.isArray(record.days) || record.days.length === 0) {
        return false
      }
      if (!record.days.every((day) => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6)) {
        return false
      }
      return typeof record.time === 'string' && TIME_PATTERN.test(record.time)
    }
    case 'startup':
      return true
    case 'fileWatch':
      return typeof record.path === 'string' && record.path.trim().length > 0
    case 'clipboard':
      return typeof record.pattern === 'string' && record.pattern.trim().length > 0
    default:
      return false
  }
}

export function describeSchedule(schedule: WorkflowSchedule): string {
  switch (schedule.kind) {
    case 'interval':
      if (schedule.minutes === 1) {
        return 'every minute'
      }
      if (schedule.minutes < 60) {
        return `every ${schedule.minutes} min`
      }
      if (schedule.minutes % 60 === 0) {
        const hours = schedule.minutes / 60
        return hours === 1 ? 'every hour' : `every ${hours} h`
      }
      return `every ${schedule.minutes} min`
    case 'time': {
      const sorted = [...schedule.days].sort((a, b) => a - b)
      const days =
        sorted.length === 7
          ? 'every day'
          : sorted.length === 5 &&
              sorted.join(',') === [1, 2, 3, 4, 5].join(',')
            ? 'Mon–Fri'
            : sorted.map((day) => WEEKDAY_SHORT[day]).join(', ')
      return `${days} at ${schedule.time}`
    }
    case 'startup':
      return 'on app start'
    case 'fileWatch':
      return `when ${schedule.path} changes`
    case 'clipboard':
      return `clipboard matches “${schedule.pattern}”`
  }
}

// Next run strictly after `from`, or null for triggers without a fixed moment
// (startup / file watch / clipboard). Interval runs are aligned to wall-clock
// boundaries so "every 5 min" fires at :00 :05 :10 …, not relative to save time.
export function nextRunAt(
  schedule: WorkflowSchedule,
  from: Date = new Date(),
): Date | null {
  if (schedule.kind === 'interval') {
    const period = schedule.minutes * 60 * 1000
    const next = Math.floor(from.getTime() / period + 1) * period
    return new Date(next)
  }
  if (schedule.kind === 'time') {
    return nextTimeRun(schedule.days, schedule.time, from)
  }
  return null
}

function nextTimeRun(days: Weekday[], time: string, from: Date): Date | null {
  const match = TIME_PATTERN.exec(time)
  if (match === null) {
    return null
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(from)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(hours, minutes, 0, 0)
    if (candidate.getTime() <= from.getTime()) {
      continue
    }
    if (days.includes(candidate.getDay() as Weekday)) {
      return candidate
    }
  }
  return null
}