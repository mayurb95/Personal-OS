import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import { clock } from './clock'
import {
  activeSession,
  addExerciseToSession,
  addSet,
  bodyWeights,
  createExercise,
  e1rm,
  exerciseProgress,
  finishSession,
  formatDuration,
  getSession,
  listExercises,
  listSessions,
  logBodyWeight,
  moveExerciseInSession,
  parseDuration,
  plannedWorkouts,
  saveRoutine,
  startSession,
  suggestWeight,
  updateSet,
  workoutStats,
} from './workouts'

let db: Database
let now = new Date('2026-10-05T01:30:00Z')
const realNow = clock.now
const BENCH = 'ex-001'
const RUN = 'ex-041'
const PUSHUP = 'ex-007'

beforeEach(async () => {
  db = await freshDb()
  now = new Date('2026-10-05T01:30:00Z')
  clock.now = () => now
})
afterEach(() => {
  clock.now = realNow
})

/** Ticks every set in a session and finishes it, an hour later. */
function doAll(id: string, patch: (setIndex: number) => Parameters<typeof updateSet>[1] extends infer P ? Omit<P & object, 'id'> : never = () => ({})) {
  const s = getSession(db, { id })
  s.items.forEach((item) => item.sets.forEach((set, i) => updateSet(db, { id: set.id, done: true, ...patch(i) })))
  now = new Date(now.getTime() + 3600_000)
  return finishSession(db, { id })
}

describe('exercises', () => {
  it('ships a starter library and accepts custom exercises', () => {
    const all = listExercises(db)
    expect(all.length).toBeGreaterThan(40)
    expect(all.find((e) => e.id === BENCH)).toMatchObject({ name: 'Bench press', kind: 'weight', muscle: 'Chest' })
    const custom = createExercise(db, { name: 'Sled push', kind: 'distance', muscle: 'Legs' })
    expect(custom.builtin).toBe(false)
    expect(() => createExercise(db, { name: 'bench press', kind: 'weight' })).toThrow(/already/)
  })
})

describe('sessions', () => {
  it('starts from a routine with targets and logs sets', () => {
    const r = saveRoutine(db, {
      name: 'Push day',
      weekdays: [0, 3],
      items: [
        { exerciseId: BENCH, sets: 3, reps: 8, weightKg: 60, restS: 120, incrementKg: 2.5 },
        { exerciseId: PUSHUP, sets: 2, reps: 15 },
      ],
    })
    expect(plannedWorkouts(db, { today: '2026-10-05' }).map((p) => p.routine.name)).toEqual(['Push day'])
    const s = startSession(db, { today: '2026-10-05', routineId: r.id })
    expect(activeSession(db)?.id).toBe(s.id)
    // Only one workout at a time.
    expect(startSession(db, { today: '2026-10-05' }).id).toBe(s.id)
    const full = getSession(db, { id: s.id })
    expect(full.name).toBe('Push day')
    expect(full.items.map((i) => [i.exercise.name, i.sets.length])).toEqual([['Bench press', 3], ['Push-up', 2]])
    expect(full.items[0]!.sets[0]).toMatchObject({ weightKg: 60, reps: 8, targetReps: 8, restS: 120, done: false })
  })

  it('drops unticked sets on finish and refuses an empty finish', () => {
    const s = startSession(db, { today: '2026-10-05' })
    addExerciseToSession(db, { sessionId: s.id, exerciseId: BENCH })
    expect(() => finishSession(db, { id: s.id })).toThrow(/Tick at least one set/)
    const first = getSession(db, { id: s.id }).items[0]!.sets[0]!
    updateSet(db, { id: first.id, weightKg: 50, reps: 10, done: true })
    const done = finishSession(db, { id: s.id })
    expect(done.sets).toBe(1)
    expect(done.volumeKg).toBe(500)
    expect(activeSession(db)).toBeNull()
  })

  it('progresses weight when every set hit its target, and shows the previous sets', () => {
    const r = saveRoutine(db, { name: 'Push', items: [{ exerciseId: BENCH, sets: 3, reps: 8, weightKg: 60, incrementKg: 2.5 }] })
    const first = startSession(db, { today: '2026-10-05', routineId: r.id })
    doAll(first.id)
    now = new Date('2026-10-08T01:30:00Z')
    const second = startSession(db, { today: '2026-10-08', routineId: r.id })
    const item = getSession(db, { id: second.id }).items[0]!
    expect(item.sets.map((x) => x.weightKg)).toEqual([62.5, 62.5, 62.5])
    expect(item.previous.map((p) => p.weightKg)).toEqual([60, 60, 60])
    // Miss a rep: next time stays at the same weight.
    doAll(second.id, (i) => (i === 2 ? { reps: 6 } : {}))
    now = new Date('2026-10-12T01:30:00Z')
    const third = startSession(db, { today: '2026-10-12', routineId: r.id })
    expect(getSession(db, { id: third.id }).items[0]!.sets[0]!.weightKg).toBe(62.5)
  })

  it('suggestWeight handles first sessions and partial data', () => {
    expect(suggestWeight({ exerciseId: 'x', sets: 3, reps: 5, weightKg: 40 }, [])).toBe(40)
    expect(suggestWeight({ exerciseId: 'x', sets: 3, reps: 5, incrementKg: 5 }, [{ weightKg: 100, reps: 5, durationS: null, distanceM: null }])).toBe(100)
  })

  it('detects personal records against earlier sessions only', () => {
    const a = startSession(db, { today: '2026-10-05' })
    addExerciseToSession(db, { sessionId: a.id, exerciseId: BENCH })
    const firstDone = doAll(a.id, () => ({ weightKg: 60, reps: 5 }))
    expect(firstDone.prs).toEqual([])
    now = new Date('2026-10-07T01:30:00Z')
    const b = startSession(db, { today: '2026-10-07' })
    addExerciseToSession(db, { sessionId: b.id, exerciseId: BENCH })
    const done = doAll(b.id, (i) => ({ weightKg: i === 0 ? 65 : 60, reps: 5 }))
    expect(done.prs.map((p) => p.label)).toEqual(['Heaviest: 65 kg'])
    expect(done.items[0]!.prSetIds).toHaveLength(1)
  })

  it('adds sets copying the last one and reorders exercises', () => {
    const s = startSession(db, { today: '2026-10-05' })
    addExerciseToSession(db, { sessionId: s.id, exerciseId: RUN })
    addExerciseToSession(db, { sessionId: s.id, exerciseId: BENCH })
    let full = getSession(db, { id: s.id })
    expect(full.items.map((i) => i.sets.length)).toEqual([1, 3])
    updateSet(db, { id: full.items[1]!.sets[2]!.id, weightKg: 40, reps: 12 })
    addSet(db, { sessionId: s.id, exerciseId: BENCH })
    moveExerciseInSession(db, { sessionId: s.id, exerciseId: BENCH, direction: 'up' })
    full = getSession(db, { id: s.id })
    expect(full.items[0]!.exercise.id).toBe(BENCH)
    expect(full.items[0]!.sets.at(-1)).toMatchObject({ weightKg: 40, reps: 12 })
  })
})

describe('progress and stats', () => {
  it('tracks best estimated 1RM per session and records', () => {
    for (const [day, w] of [['2026-10-05', 60], ['2026-10-07', 70]] as const) {
      now = new Date(`${day}T01:30:00Z`)
      const s = startSession(db, { today: day })
      addExerciseToSession(db, { sessionId: s.id, exerciseId: BENCH })
      doAll(s.id, () => ({ weightKg: w, reps: 5 }))
    }
    const p = exerciseProgress(db, { id: BENCH })
    expect(p.points.map((x) => x.value)).toEqual([70, 81.67])
    expect(p.records[0]).toEqual({ label: 'Heaviest weight', value: '70 kg', day: '2026-10-07' })
    expect(p.records.at(-1)).toEqual({ label: 'Times done', value: '2', day: null })
    expect(e1rm(100, 1)).toBe(100)
  })

  it('records distance and pace for cardio', () => {
    const s = startSession(db, { today: '2026-10-05' })
    addExerciseToSession(db, { sessionId: s.id, exerciseId: RUN })
    doAll(s.id, () => ({ distanceM: 5000, durationS: 1500 }))
    const p = exerciseProgress(db, { id: RUN })
    expect(p.records.map((r) => r.value)).toEqual(['5 km', '5:00 /km', '1'])
  })

  it('counts weekly workouts, streaks and sets per muscle', () => {
    for (const day of ['2026-09-22', '2026-09-29', '2026-10-05', '2026-10-06']) {
      now = new Date(`${day}T01:30:00Z`)
      const s = startSession(db, { today: day })
      addExerciseToSession(db, { sessionId: s.id, exerciseId: BENCH })
      doAll(s.id, () => ({ weightKg: 50, reps: 10 }))
    }
    const st = workoutStats(db, { today: '2026-10-07', weeks: 4 })
    expect(st.thisWeek).toBe(2)
    expect(st.weekStreak).toBe(3)
    expect(st.weekly.map((w) => w.sessions)).toEqual([0, 1, 1, 2])
    expect(st.muscles).toEqual([{ muscle: 'Chest', thisWeek: 6, lastWeek: 3 }])
    expect(listSessions(db, { limit: 2 }).map((s) => s.day)).toEqual(['2026-10-06', '2026-10-05'])
  })

  it('logs body weight', () => {
    logBodyWeight(db, { day: '2026-10-05', weightKg: 72.34 })
    logBodyWeight(db, { day: '2026-10-05', weightKg: 72.1 })
    expect(bodyWeights(db)).toEqual([{ day: '2026-10-05', weightKg: 72.1 }])
    expect(() => logBodyWeight(db, { day: '2026-10-06', weightKg: 5 })).toThrow()
  })

  it('formats and parses durations', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(parseDuration('1:15')).toBe(75)
    expect(parseDuration('30')).toBe(1800)
    expect(parseDuration('1:02:05')).toBe(3725)
    expect(parseDuration('x')).toBeNull()
  })
})
