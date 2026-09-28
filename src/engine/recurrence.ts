/** Repeat rules for tasks: "every day", "every Mon and Thu", "every 2 weeks", "3 days after completion". */
import {
  addDays,
  addMonths,
  dayOfMonth,
  daysBetween,
  type ISODate,
  ordinal,
  startOfWeek,
  WEEKDAY_SHORT,
  weekday,
} from './dates'

export interface Recurrence {
  freq: 'day' | 'week' | 'month'
  /** Every N days/weeks/months (at least 1). */
  interval: number
  /** For weekly rules: which weekdays (Monday = 0). Empty = same weekday as the task. */
  weekdays?: number[]
  /** Count from the day the task is completed instead of from its due date. */
  fromCompletion?: boolean
}

export function isRecurrence(value: unknown): value is Recurrence {
  if (!value || typeof value !== 'object') return false
  const r = value as Partial<Recurrence>
  return (
    (r.freq === 'day' || r.freq === 'week' || r.freq === 'month') &&
    typeof r.interval === 'number' &&
    r.interval >= 1
  )
}

/** The first occurrence strictly after `from`. */
export function nextOccurrence(rule: Recurrence, from: ISODate): ISODate {
  const interval = Math.max(1, Math.floor(rule.interval))
  if (rule.freq === 'day') return addDays(from, interval)
  if (rule.freq === 'month') return addMonths(from, interval)
  const days = rule.weekdays?.length ? [...new Set(rule.weekdays)].sort() : [weekday(from)]
  if (days.length === 1 && days[0] === weekday(from)) return addDays(from, 7 * interval)
  const anchor = startOfWeek(from)
  for (let i = 1; i <= 7 * interval + 7; i++) {
    const d = addDays(from, i)
    const weeksApart = Math.floor(daysBetween(anchor, startOfWeek(d)) / 7)
    if (weeksApart % interval === 0 && days.includes(weekday(d))) return d
  }
  return addDays(from, 7 * interval)
}

/** The first occurrence on or after `from` (used to place a new repeating task). */
export function firstOccurrence(rule: Recurrence, from: ISODate): ISODate {
  if (rule.freq === 'week' && rule.weekdays?.length && !rule.weekdays.includes(weekday(from))) {
    return nextOccurrence(rule, from)
  }
  return from
}

/**
 * When a repeating task is completed: the next due date.
 * Always lands after today, so an overdue daily task doesn't come back already overdue.
 */
export function nextDueAfterCompletion(rule: Recurrence, due: ISODate | null, today: ISODate): ISODate {
  let next = nextOccurrence(rule, rule.fromCompletion || !due ? today : due)
  for (let guard = 0; next <= today && guard < 1000; guard++) next = nextOccurrence(rule, next)
  return next
}

export function describeRecurrence(rule: Recurrence, due?: ISODate | null): string {
  const n = rule.interval
  if (rule.fromCompletion) {
    const unit = rule.freq === 'day' ? 'day' : rule.freq === 'week' ? 'week' : 'month'
    return `${n} ${unit}${n === 1 ? '' : 's'} after completion`
  }
  if (rule.freq === 'day') return n === 1 ? 'Every day' : `Every ${n} days`
  if (rule.freq === 'month') {
    const on = due ? ` on the ${ordinal(dayOfMonth(due))}` : ''
    return (n === 1 ? 'Every month' : `Every ${n} months`) + on
  }
  const days = rule.weekdays?.length ? [...rule.weekdays].sort() : due ? [weekday(due)] : []
  const weekdaysOnly = days.length === 5 && days.every((d, i) => d === i)
  const names = weekdaysOnly ? 'weekday' : days.map((d) => WEEKDAY_SHORT[d]).join(', ')
  if (n === 1) return days.length ? `Every ${names}` : 'Every week'
  return days.length ? `Every ${n} weeks on ${names}` : `Every ${n} weeks`
}
