/**
 * The built-in Habits module. Each habit is a record in the 'habits' collection; each day's
 * check-in is a row in `habit_logs` (value, or "skipped" for rest days that keep a streak).
 */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { nowISO } from './clock'
import {
  addDays,
  daysBetween,
  type ISODate,
  isISODate,
  localDate,
  startOfWeek,
  weekday,
} from './dates'
import { createRecord, recordFromRow, requireRecord, updateRecord } from './records'
import type { RecordData, RecordItem } from './types'

export const HABITS = 'habits'

/**
 * check: done or not · count: taps toward a target (8 glasses) · measure: a number with a unit
 * (7.5 h sleep) · duration: minutes · scale: a 1–5 score · limit: occurrences to keep at or under a limit.
 */
export type HabitKind = 'check' | 'count' | 'measure' | 'duration' | 'scale' | 'limit'

export type HabitSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'weekly'; times: number }
  | { type: 'interval'; every: number; start: ISODate }

export type PartOfDay = 'morning' | 'anytime' | 'evening'

export interface Habit {
  id: string
  name: string
  notes: string
  kind: HabitKind
  target: number
  unit: string
  schedule: HabitSchedule
  partOfDay: PartOfDay
  archived: boolean
  createdAt: string
  /** Local date the habit starts counting from. */
  startDate: ISODate
}

export interface HabitLog {
  day: ISODate
  value: number
  skipped: boolean
}

export type DayState = 'done' | 'partial' | 'missed' | 'skipped' | 'off' | 'future' | 'before'

export interface HabitStatus {
  habit: Habit
  today: HabitLog | null
  scheduledToday: boolean
  doneToday: boolean
  /** For weekly habits: check-ins this week. */
  weekCount: number
  streak: number
  streakUnit: 'days' | 'weeks'
  bestStreak: number
  /** Share of scheduled days (or weeks) completed in the last 30 days, 0–100. */
  rate30: number
  /** Monday–Sunday of the current week. */
  week: { day: ISODate; state: DayState; value: number }[]
}

const KINDS: HabitKind[] = ['check', 'count', 'measure', 'duration', 'scale', 'limit']

function scheduleFrom(value: unknown, fallbackStart: ISODate): HabitSchedule {
  const s = (value ?? {}) as Partial<{ type: string; days: unknown; times: unknown; every: unknown; start: unknown }>
  if (s.type === 'weekdays' && Array.isArray(s.days) && s.days.length) {
    return { type: 'weekdays', days: [...new Set(s.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() }
  }
  if (s.type === 'weekly' && Number(s.times) >= 1) {
    return { type: 'weekly', times: Math.min(7, Math.round(Number(s.times))) }
  }
  if (s.type === 'interval' && Number(s.every) >= 2) {
    return {
      type: 'interval',
      every: Math.round(Number(s.every)),
      start: isISODate(s.start) ? s.start : fallbackStart,
    }
  }
  return { type: 'daily' }
}

export function habitFromRecord(r: RecordItem): Habit {
  const d = r.data
  const kind = KINDS.includes(d.kind as HabitKind) ? (d.kind as HabitKind) : 'check'
  const startDate = localDate(new Date(r.createdAt))
  const target = Number(d.target)
  return {
    id: r.id,
    name: r.title,
    notes: r.body,
    kind,
    target: Number.isFinite(target) && target >= 0 ? target : defaultTarget(kind),
    unit: typeof d.unit === 'string' ? d.unit : '',
    schedule: scheduleFrom(d.schedule, startDate),
    partOfDay: d.part_of_day === 'morning' || d.part_of_day === 'evening' ? d.part_of_day : 'anytime',
    archived: d.archived === true,
    createdAt: r.createdAt,
    startDate,
  }
}

export function defaultTarget(kind: HabitKind): number {
  return kind === 'limit' ? 0 : 1
}

export interface HabitInput {
  name?: string
  notes?: string
  kind?: HabitKind
  target?: number
  unit?: string
  schedule?: HabitSchedule
  partOfDay?: PartOfDay
  archived?: boolean
}

function toData(p: HabitInput): RecordData {
  const data: RecordData = {}
  if (p.kind !== undefined) data.kind = p.kind
  if (p.target !== undefined) data.target = p.target
  if (p.unit !== undefined) data.unit = p.unit.trim() || null
  if (p.schedule !== undefined) data.schedule = p.schedule as unknown as RecordData[string]
  if (p.partOfDay !== undefined) data.part_of_day = p.partOfDay
  if (p.archived !== undefined) data.archived = p.archived || null
  return data
}

export function createHabit(db: Database, p: HabitInput & { name: string }): Habit {
  const name = p.name.trim()
  if (!name) throw new Error('Give the habit a name.')
  const kind = p.kind ?? 'check'
  return habitFromRecord(
    createRecord(db, {
      collectionId: HABITS,
      title: name,
      body: p.notes ?? '',
      data: toData({ ...p, kind, target: p.target ?? defaultTarget(kind) }),
    }),
  )
}

export function getHabit(db: Database, p: { id: string }): Habit {
  const r = requireRecord(db, p.id)
  if (r.collectionId !== HABITS) throw new Error('That item isn’t a habit.')
  return habitFromRecord(r)
}

export function updateHabit(db: Database, p: { id: string } & HabitInput): Habit {
  getHabit(db, { id: p.id })
  if (p.name !== undefined && !p.name.trim()) throw new Error('Give the habit a name.')
  return habitFromRecord(updateRecord(db, { id: p.id, title: p.name, body: p.notes, data: toData(p) }))
}

export function isScheduled(habit: Habit, day: ISODate): boolean {
  const s = habit.schedule
  switch (s.type) {
    case 'weekdays':
      return s.days.includes(weekday(day))
    case 'interval': {
      const diff = daysBetween(s.start, day)
      return diff >= 0 && diff % s.every === 0
    }
    default:
      return true
  }
}

/** Whether a day's log meets the habit's goal. */
export function isDone(habit: Habit, log: HabitLog | undefined | null): boolean {
  if (habit.kind === 'limit') return (log?.value ?? 0) <= habit.target
  if (!log) return false
  if (habit.kind === 'check' || habit.kind === 'scale') return log.value > 0
  return log.value >= Math.max(habit.target, Number.EPSILON)
}

function logsBetween(db: Database, habitId: string, from: ISODate, to: ISODate): Map<ISODate, HabitLog> {
  return new Map(
    db
      .selectObjects(
        'SELECT day, value, skipped FROM habit_logs WHERE habit_id = ? AND day BETWEEN ? AND ?',
        [habitId, from, to],
      )
      .map((r) => [
        String(r.day),
        { day: String(r.day), value: Number(r.value), skipped: Number(r.skipped) === 1 },
      ]),
  )
}

export function habitLogs(
  db: Database,
  p: { habitId: string; from: ISODate; to: ISODate },
): HabitLog[] {
  return [...logsBetween(db, p.habitId, p.from, p.to).values()].sort((a, b) => a.day.localeCompare(b.day))
}

function dayState(habit: Habit, day: ISODate, log: HabitLog | undefined, today: ISODate): DayState {
  if (day < habit.startDate) return 'before'
  if (day > today) return 'future'
  if (log?.skipped) return 'skipped'
  const done = isDone(habit, log)
  if (habit.schedule.type !== 'weekly' && !isScheduled(habit, day)) {
    return log && log.value > 0 && done ? 'done' : 'off'
  }
  if (habit.kind === 'limit' && day === today) return done ? 'partial' : 'missed'
  if (done) return 'done'
  return day === today ? 'partial' : 'missed'
}

/** Current and best streaks: consecutive scheduled days (or weeks, for weekly habits) completed. */
export function computeStreaks(
  habit: Habit,
  logs: Map<ISODate, HabitLog>,
  today: ISODate,
): { streak: number; best: number } {
  if (habit.schedule.type === 'weekly') {
    const need = habit.schedule.times
    const weekMet = (monday: ISODate) => {
      let n = 0
      for (let i = 0; i < 7; i++) {
        const d = addDays(monday, i)
        const log = logs.get(d)
        if (log && !log.skipped && isDone(habit, log)) n++
      }
      return n >= need
    }
    const first = startOfWeek(habit.startDate)
    let streak = 0
    let best = 0
    let run = 0
    let currentOpen = true
    for (let w = startOfWeek(today); w >= first; w = addDays(w, -7)) {
      const met = weekMet(w)
      if (w === startOfWeek(today) && !met) continue
      if (met) {
        run++
        if (currentOpen) streak = run
      } else {
        currentOpen = false
        run = 0
      }
      best = Math.max(best, run)
    }
    return { streak, best: Math.max(best, streak) }
  }

  let streak = 0
  let best = 0
  let run = 0
  let currentOpen = true
  for (let d = today; d >= habit.startDate; d = addDays(d, -1)) {
    if (!isScheduled(habit, d)) continue
    const log = logs.get(d)
    if (log?.skipped) continue
    const done = isDone(habit, log)
    // Today doesn't break the streak until it's over; a limit habit's day only counts once over.
    if (d === today && (!done || habit.kind === 'limit')) continue
    if (done) {
      run++
      if (currentOpen) streak = run
    } else {
      currentOpen = false
      run = 0
    }
    best = Math.max(best, run)
  }
  return { streak, best }
}

function completionRate(habit: Habit, logs: Map<ISODate, HabitLog>, today: ISODate): number {
  const from = [addDays(today, -29), habit.startDate].sort().at(-1)!
  if (habit.schedule.type === 'weekly') {
    const need = habit.schedule.times
    let weeks = 0
    let met = 0
    for (let w = startOfWeek(from); w <= today; w = addDays(w, 7)) {
      let n = 0
      for (let i = 0; i < 7; i++) {
        const log = logs.get(addDays(w, i))
        if (log && !log.skipped && isDone(habit, log)) n++
      }
      const isCurrent = w === startOfWeek(today)
      if (isCurrent && n < need) continue
      weeks++
      if (n >= need) met++
    }
    return weeks ? Math.round((met / weeks) * 100) : 0
  }
  let scheduled = 0
  let done = 0
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue
    const log = logs.get(d)
    if (log?.skipped) continue
    const ok = isDone(habit, log)
    if (d === today && (!ok || habit.kind === 'limit')) continue
    scheduled++
    if (ok) done++
  }
  return scheduled ? Math.round((done / scheduled) * 100) : 0
}

export function habitStatus(habit: Habit, logs: Map<ISODate, HabitLog>, today: ISODate): HabitStatus {
  const monday = startOfWeek(today)
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const log = logs.get(day)
    return { day, state: dayState(habit, day, log, today), value: log?.value ?? 0 }
  })
  const todayLog = logs.get(today) ?? null
  const { streak, best } = computeStreaks(habit, logs, today)
  const weekCount =
    habit.schedule.type === 'weekly'
      ? week.filter((w) => {
          const log = logs.get(w.day)
          return log && !log.skipped && isDone(habit, log)
        }).length
      : 0
  return {
    habit,
    today: todayLog,
    scheduledToday:
      habit.schedule.type === 'weekly'
        ? weekCount < habit.schedule.times || isDone(habit, todayLog)
        : isScheduled(habit, today),
    doneToday: habit.kind === 'limit' ? false : isDone(habit, todayLog),
    weekCount,
    streak,
    streakUnit: habit.schedule.type === 'weekly' ? 'weeks' : 'days',
    bestStreak: best,
    rate30: completionRate(habit, logs, today),
    week,
  }
}

export function listHabits(
  db: Database,
  p: { today: ISODate; includeArchived?: boolean },
): HabitStatus[] {
  const habits = db
    .selectObjects(
      `SELECT * FROM records WHERE collection_id = 'habits' AND deleted_at IS NULL ORDER BY created_at`,
    )
    .map((row) => habitFromRecord(recordFromRow(row)))
    .filter((h) => p.includeArchived || !h.archived)
  // Streaks look back up to about two years.
  const from = addDays(p.today, -730)
  return habits.map((h) => habitStatus(h, logsBetween(db, h.id, from, p.today), p.today))
}

export function getHabitStatus(db: Database, p: { id: string; today: ISODate }): HabitStatus {
  const habit = getHabit(db, { id: p.id })
  return habitStatus(habit, logsBetween(db, habit.id, addDays(p.today, -730), p.today), p.today)
}

/** Sets a day's value. A value of 0 (and not skipped) removes the check-in. */
export function logHabit(
  db: Database,
  p: { habitId: string; day: ISODate; value: number; skipped?: boolean },
): HabitLog | null {
  getHabit(db, { id: p.habitId })
  if (!isISODate(p.day)) throw new Error('Invalid date.')
  const value = Number.isFinite(p.value) ? Math.max(0, p.value) : 0
  if (value === 0 && !p.skipped) {
    db.exec({ sql: 'DELETE FROM habit_logs WHERE habit_id = ? AND day = ?', bind: [p.habitId, p.day] })
    return null
  }
  db.exec({
    sql: `INSERT INTO habit_logs (habit_id, day, value, skipped, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(habit_id, day) DO UPDATE SET value = excluded.value, skipped = excluded.skipped,
          updated_at = excluded.updated_at`,
    bind: [p.habitId, p.day, value, p.skipped ? 1 : 0, nowISO()],
  })
  return { day: p.day, value, skipped: Boolean(p.skipped) }
}

/**
 * The one-tap action from Today: check habits toggle, count and limit habits add one.
 * Measures, durations and scales need a value, so the UI asks for it instead.
 */
export function tapHabit(db: Database, p: { habitId: string; day: ISODate }): HabitLog | null {
  const habit = getHabit(db, { id: p.habitId })
  const current = logsBetween(db, habit.id, p.day, p.day).get(p.day)
  if (habit.kind === 'check') {
    return logHabit(db, { habitId: habit.id, day: p.day, value: current && !current.skipped ? 0 : 1 })
  }
  if (habit.kind === 'count' || habit.kind === 'limit') {
    return logHabit(db, { habitId: habit.id, day: p.day, value: (current?.skipped ? 0 : current?.value ?? 0) + 1 })
  }
  throw new Error('This habit needs a value.')
}
