import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import { clock } from './clock'
import { addDays } from './dates'
import {
  computeStreaks,
  createHabit,
  getHabitStatus,
  type Habit,
  type HabitLog,
  isScheduled,
  listHabits,
  logHabit,
  tapHabit,
  updateHabit,
} from './habits'

// Monday 28 September 2026; habits are created on Tuesday 1 September.
const TODAY = '2026-09-28'
const CREATED = new Date('2026-09-01T06:00:00Z')

let db: Database
const realNow = clock.now

beforeEach(async () => {
  db = await freshDb()
  clock.now = () => CREATED
})

afterEach(() => {
  clock.now = realNow
})

function daily(name = 'Meditate', extra: Parameters<typeof createHabit>[1] extends infer T ? Partial<T> : never = {}): Habit {
  return createHabit(db, { name, ...extra })
}

describe('habits', () => {
  it('creates habits with sensible defaults', () => {
    const h = daily()
    expect(h).toMatchObject({ kind: 'check', target: 1, schedule: { type: 'daily' }, partOfDay: 'anytime', startDate: '2026-09-01' })
    expect(createHabit(db, { name: 'Late-night phone', kind: 'limit' }).target).toBe(0)
    expect(() => createHabit(db, { name: ' ' })).toThrow()
  })

  it('knows which days are scheduled', () => {
    const weekdays = createHabit(db, { name: 'Walk', schedule: { type: 'weekdays', days: [0, 2, 4] } })
    expect(isScheduled(weekdays, TODAY)).toBe(true)
    expect(isScheduled(weekdays, '2026-09-29')).toBe(false)
    const every3 = createHabit(db, { name: 'Stretch', schedule: { type: 'interval', every: 3, start: '2026-09-25' } })
    expect(isScheduled(every3, TODAY)).toBe(true)
    expect(isScheduled(every3, '2026-09-27')).toBe(false)
    expect(isScheduled(every3, '2026-09-22')).toBe(false)
  })

  it('toggles check habits and counts taps', () => {
    const h = daily()
    expect(tapHabit(db, { habitId: h.id, day: TODAY })?.value).toBe(1)
    expect(tapHabit(db, { habitId: h.id, day: TODAY })).toBeNull()
    const water = createHabit(db, { name: 'Water', kind: 'count', target: 8, unit: 'glasses' })
    tapHabit(db, { habitId: water.id, day: TODAY })
    expect(tapHabit(db, { habitId: water.id, day: TODAY })?.value).toBe(2)
    const sleep = createHabit(db, { name: 'Sleep', kind: 'measure', target: 7, unit: 'h' })
    expect(() => tapHabit(db, { habitId: sleep.id, day: TODAY })).toThrow()
  })

  it('counts a daily streak, where an unfinished today does not break it', () => {
    const h = daily()
    for (let i = 1; i <= 5; i++) logHabit(db, { habitId: h.id, day: addDays(TODAY, -i), value: 1 })
    let s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streak).toBe(5)
    expect(s.doneToday).toBe(false)
    expect(s.week[0]!.state).toBe('partial')
    logHabit(db, { habitId: h.id, day: TODAY, value: 1 })
    s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streak).toBe(6)
    expect(s.bestStreak).toBe(6)
  })

  it('keeps a streak across skipped days and breaks it on a miss', () => {
    const h = daily()
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -1), value: 1 })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -2), value: 0, skipped: true })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -3), value: 1 })
    // -4 missed
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -5), value: 1 })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -6), value: 1 })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -7), value: 1 })
    const s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streak).toBe(2)
    expect(s.bestStreak).toBe(3)
  })

  it('only counts scheduled days for weekday habits', () => {
    const h = createHabit(db, { name: 'Gym', schedule: { type: 'weekdays', days: [0, 2, 4] } })
    // Fri 25, Wed 23, Mon 21 done; Tue/Thu off days don't matter.
    for (const d of ['2026-09-25', '2026-09-23', '2026-09-21']) logHabit(db, { habitId: h.id, day: d, value: 1 })
    expect(getHabitStatus(db, { id: h.id, today: TODAY }).streak).toBe(3)
  })

  it('needs the target for count habits', () => {
    const h = createHabit(db, { name: 'Water', kind: 'count', target: 8 })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -1), value: 8 })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -2), value: 5 })
    const s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streak).toBe(1)
  })

  it('counts clean days for limit habits', () => {
    const h = createHabit(db, { name: 'Late-night phone', kind: 'limit' })
    logHabit(db, { habitId: h.id, day: addDays(TODAY, -4), value: 2 })
    const s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streak).toBe(3)
    expect(s.doneToday).toBe(false)
  })

  it('counts weekly habits in weeks', () => {
    const h = createHabit(db, { name: 'Long run', schedule: { type: 'weekly', times: 2 } })
    // Two runs in each of the last two full weeks; one so far this week.
    for (const d of ['2026-09-14', '2026-09-17', '2026-09-22', '2026-09-26', TODAY]) {
      logHabit(db, { habitId: h.id, day: d, value: 1 })
    }
    const s = getHabitStatus(db, { id: h.id, today: TODAY })
    expect(s.streakUnit).toBe('weeks')
    expect(s.streak).toBe(2)
    expect(s.weekCount).toBe(1)
    expect(s.scheduledToday).toBe(true)
  })

  it('computes a 30-day completion rate', () => {
    const h = daily()
    for (let i = 1; i <= 27; i += 2) logHabit(db, { habitId: h.id, day: addDays(TODAY, -i), value: 1 })
    // Created 1 Sep: 27 finished days (1–27 Sep), 14 of them done.
    expect(getHabitStatus(db, { id: h.id, today: TODAY }).rate30).toBe(52)
  })

  it('lists habits and hides archived ones', () => {
    const a = daily('A')
    daily('B')
    updateHabit(db, { id: a.id, archived: true })
    expect(listHabits(db, { today: TODAY }).map((s) => s.habit.name)).toEqual(['B'])
    expect(listHabits(db, { today: TODAY, includeArchived: true })).toHaveLength(2)
  })

  it('computeStreaks works without any logs', () => {
    const h = daily()
    expect(computeStreaks(h, new Map<string, HabitLog>(), TODAY)).toEqual({ streak: 0, best: 0 })
  })
})
