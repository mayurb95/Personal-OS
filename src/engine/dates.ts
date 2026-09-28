/**
 * Calendar-date helpers that work on plain 'YYYY-MM-DD' strings.
 *
 * Dates are the user's local calendar days. Arithmetic is done in UTC on those strings,
 * so daylight-saving shifts and time zones can never move a date by one.
 */

export type ISODate = string

const DAY_MS = 86_400_000

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUTC(value))
}

/** The local calendar date of a JavaScript Date (default: now). */
export function localDate(date: Date = new Date()): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

/** Adds months, keeping the day of month where possible (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: ISODate, months: number, preferredDay?: number): ISODate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const day = Math.min(preferredDay ?? d, daysInMonth(ny, nm))
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS)
}

/** Day of week with Monday = 0 … Sunday = 6. */
export function weekday(date: ISODate): number {
  return (new Date(toUTC(date)).getUTCDay() + 6) % 7
}

/** The Monday on or before the date. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekday(date))
}

export function dayOfMonth(date: ISODate): number {
  return Number(date.slice(8, 10))
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const WEEKDAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** "Today", "Tomorrow", "Yesterday", "Friday" (within the coming week), "3 Oct", "3 Oct 2027". */
export function formatDay(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return WEEKDAY_LONG[weekday(date)]!
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const label = `${d} ${MONTH_SHORT[m - 1]}`
  return y === Number(today.slice(0, 4)) ? label : `${label} ${y}`
}

/** "Mon, 3 Oct" style label with weekday, for headers. */
export function formatDayWithWeekday(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${WEEKDAY_SHORT[weekday(date)]}, ${d} ${MONTH_SHORT[m - 1]}`
}

/** '17:05' → '5:05 pm' (Indian English style). */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function ordinal(n: number): string {
  const s = n % 100
  if (s >= 11 && s <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
