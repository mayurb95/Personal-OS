/**
 * Workouts: exercise library, routines (planned workouts on chosen weekdays), live sessions
 * logged set by set, personal records, progress and body weight. Metric units throughout.
 */
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import { clock, newId, nowISO } from './clock'
import { addDays, type ISODate, isISODate, startOfWeek, weekday } from './dates'
import type { ExerciseKind } from './seed'

export type { ExerciseKind } from './seed'

type Row = Record<string, SqlValue>

const num = (v: SqlValue | undefined): number | null => (v === null || v === undefined ? null : Number(v))

// ── Exercises ───────────────────────────────────────────────────────────────

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  muscle: string
  equipment: string
  notes: string
  builtin: boolean
  archived: boolean
  /** Day this exercise was last done, if ever. */
  lastDone: ISODate | null
}

const KINDS: ExerciseKind[] = ['weight', 'reps', 'time', 'distance']

function exerciseFromRow(r: Row): Exercise {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: KINDS.includes(r.kind as ExerciseKind) ? (r.kind as ExerciseKind) : 'weight',
    muscle: String(r.muscle ?? ''),
    equipment: String(r.equipment ?? ''),
    notes: String(r.notes ?? ''),
    builtin: Number(r.builtin) === 1,
    archived: r.archived_at != null,
    lastDone: r.last_done == null ? null : String(r.last_done),
  }
}

const EXERCISE_SELECT = `SELECT e.*, (
    SELECT max(s.day) FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
    WHERE ws.exercise_id = e.id AND ws.done = 1 AND s.ended_at IS NOT NULL
  ) AS last_done FROM exercises e`

export function listExercises(db: Database, p: { includeArchived?: boolean } = {}): Exercise[] {
  return db
    .selectObjects(
      `${EXERCISE_SELECT} ${p.includeArchived ? '' : 'WHERE e.archived_at IS NULL'} ORDER BY e.name COLLATE NOCASE`,
    )
    .map(exerciseFromRow)
}

export function getExercise(db: Database, p: { id: string }): Exercise {
  const row = db.selectObjects(`${EXERCISE_SELECT} WHERE e.id = ?`, [p.id])[0]
  if (!row) throw new Error('That exercise no longer exists.')
  return exerciseFromRow(row)
}

export function createExercise(
  db: Database,
  p: { name: string; kind: ExerciseKind; muscle?: string; equipment?: string; notes?: string },
): Exercise {
  const name = p.name.trim()
  if (!name) throw new Error('Give the exercise a name.')
  if (!KINDS.includes(p.kind)) throw new Error('Choose what to track for this exercise.')
  const clash = db.selectValue(
    'SELECT id FROM exercises WHERE lower(name) = lower(?) AND archived_at IS NULL',
    [name],
  )
  if (clash) throw new Error(`“${name}” is already in your exercises.`)
  const id = newId()
  db.exec({
    sql: `INSERT INTO exercises (id, name, kind, muscle, equipment, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    bind: [id, name, p.kind, p.muscle?.trim() ?? '', p.equipment?.trim() ?? '', p.notes ?? '', nowISO()],
  })
  return getExercise(db, { id })
}

export function updateExercise(
  db: Database,
  p: { id: string; name?: string; muscle?: string; equipment?: string; notes?: string; archived?: boolean },
): Exercise {
  const e = getExercise(db, { id: p.id })
  const name = p.name?.trim()
  if (p.name !== undefined && !name) throw new Error('Give the exercise a name.')
  db.exec({
    sql: `UPDATE exercises SET name = ?, muscle = ?, equipment = ?, notes = ?, archived_at = ? WHERE id = ?`,
    bind: [
      name ?? e.name,
      p.muscle ?? e.muscle,
      p.equipment ?? e.equipment,
      p.notes ?? e.notes,
      p.archived === undefined ? (e.archived ? nowISO() : null) : p.archived ? nowISO() : null,
      p.id,
    ],
  })
  return getExercise(db, { id: p.id })
}

// ── Routines ────────────────────────────────────────────────────────────────

export interface RoutineItem {
  exerciseId: string
  sets: number
  reps?: number | null
  weightKg?: number | null
  durationS?: number | null
  distanceM?: number | null
  restS?: number | null
  /** Weight to add next time when every set reached its target reps (0 = no progression). */
  incrementKg?: number | null
}

export interface Routine {
  id: string
  name: string
  notes: string
  weekdays: number[]
  items: RoutineItem[]
  archived: boolean
  lastDone: ISODate | null
}

function routineFromRow(r: Row): Routine {
  const parse = <T>(v: SqlValue | undefined, fallback: T): T => {
    try {
      return JSON.parse(String(v)) as T
    } catch {
      return fallback
    }
  }
  return {
    id: String(r.id),
    name: String(r.name),
    notes: String(r.notes ?? ''),
    weekdays: parse<number[]>(r.weekdays, []),
    items: parse<RoutineItem[]>(r.items, []),
    archived: r.archived_at != null,
    lastDone: r.last_done == null ? null : String(r.last_done),
  }
}

const ROUTINE_SELECT = `SELECT r.*, (
    SELECT max(day) FROM workout_sessions s WHERE s.routine_id = r.id AND s.ended_at IS NOT NULL
  ) AS last_done FROM routines r`

export function listRoutines(db: Database): Routine[] {
  return db
    .selectObjects(`${ROUTINE_SELECT} WHERE r.archived_at IS NULL ORDER BY r.sort, r.created_at`)
    .map(routineFromRow)
}

export function getRoutine(db: Database, p: { id: string }): Routine {
  const row = db.selectObjects(`${ROUTINE_SELECT} WHERE r.id = ?`, [p.id])[0]
  if (!row) throw new Error('That routine no longer exists.')
  return routineFromRow(row)
}

function cleanItems(items: RoutineItem[]): RoutineItem[] {
  const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  return items
    .filter((i) => i.exerciseId)
    .map((i) => ({
      exerciseId: i.exerciseId,
      sets: Math.max(1, Math.min(20, Math.round(i.sets || 1))),
      reps: pos(i.reps) && Math.round(i.reps!),
      weightKg: pos(i.weightKg),
      durationS: pos(i.durationS) && Math.round(i.durationS!),
      distanceM: pos(i.distanceM),
      restS: pos(i.restS) && Math.round(i.restS!),
      incrementKg: pos(i.incrementKg),
    }))
}

export function saveRoutine(
  db: Database,
  p: { id?: string; name: string; notes?: string; weekdays?: number[]; items?: RoutineItem[] },
): Routine {
  const name = p.name.trim()
  if (!name) throw new Error('Give the routine a name.')
  const weekdays = [...new Set((p.weekdays ?? []).filter((d) => d >= 0 && d <= 6))].sort()
  const items = cleanItems(p.items ?? [])
  const now = nowISO()
  if (p.id) {
    const r = getRoutine(db, { id: p.id })
    db.exec({
      sql: 'UPDATE routines SET name = ?, notes = ?, weekdays = ?, items = ?, updated_at = ? WHERE id = ?',
      bind: [name, p.notes ?? r.notes, JSON.stringify(weekdays), JSON.stringify(items), now, p.id],
    })
    return getRoutine(db, { id: p.id })
  }
  const id = newId()
  const sort = Number(db.selectValue('SELECT coalesce(max(sort), 0) + 1 FROM routines') ?? 1)
  db.exec({
    sql: `INSERT INTO routines (id, name, notes, weekdays, items, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [id, name, p.notes ?? '', JSON.stringify(weekdays), JSON.stringify(items), sort, now, now],
  })
  return getRoutine(db, { id })
}

export function deleteRoutine(db: Database, p: { id: string }): void {
  db.exec({ sql: 'UPDATE routines SET archived_at = ? WHERE id = ?', bind: [nowISO(), p.id] })
}

// ── Sessions and sets ───────────────────────────────────────────────────────

export interface WorkoutSet {
  id: string
  setOrder: number
  weightKg: number | null
  reps: number | null
  durationS: number | null
  distanceM: number | null
  targetReps: number | null
  restS: number
  done: boolean
}

export interface PreviousSet {
  weightKg: number | null
  reps: number | null
  durationS: number | null
  distanceM: number | null
}

export interface SessionExercise {
  exercise: Exercise
  order: number
  sets: WorkoutSet[]
  /** The sets done the last time this exercise was logged, for the "previous" column. */
  previous: PreviousSet[]
  /** Set ids that beat a previous best when the session was finished. */
  prSetIds: string[]
}

export interface SessionSummary {
  id: string
  name: string
  routineId: string | null
  day: ISODate
  startedAt: string
  endedAt: string | null
  notes: string
  durationS: number
  /** kg × reps over completed weighted sets. */
  volumeKg: number
  sets: number
  exercises: string[]
  distanceM: number
}

export interface Session extends SessionSummary {
  items: SessionExercise[]
  prs: PersonalRecordHit[]
}

export interface PersonalRecordHit {
  exerciseId: string
  exerciseName: string
  setId: string
  label: string
}

function setFromRow(r: Row): WorkoutSet {
  return {
    id: String(r.id),
    setOrder: Number(r.set_order),
    weightKg: num(r.weight_kg),
    reps: num(r.reps),
    durationS: num(r.duration_s),
    distanceM: num(r.distance_m),
    targetReps: num(r.target_reps),
    restS: Number(r.rest_s ?? 90),
    done: Number(r.done) === 1,
  }
}

function summaryFromRow(r: Row): SessionSummary {
  const started = String(r.started_at)
  const ended = r.ended_at == null ? null : String(r.ended_at)
  const end = ended ? new Date(ended).getTime() : clock.now().getTime()
  return {
    id: String(r.id),
    name: String(r.name),
    routineId: r.routine_id == null ? null : String(r.routine_id),
    day: String(r.day),
    startedAt: started,
    endedAt: ended,
    notes: String(r.notes ?? ''),
    durationS: Math.max(0, Math.round((end - new Date(started).getTime()) / 1000)),
    volumeKg: Math.round(Number(r.volume ?? 0) * 10) / 10,
    sets: Number(r.set_count ?? 0),
    exercises: r.exercise_names ? String(r.exercise_names).split('\u001f') : [],
    distanceM: Number(r.distance ?? 0),
  }
}

const SUMMARY_SELECT = `SELECT s.*,
    (SELECT sum(coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0)) FROM workout_sets ws WHERE ws.session_id = s.id AND ws.done = 1) AS volume,
    (SELECT count(*) FROM workout_sets ws WHERE ws.session_id = s.id AND ws.done = 1) AS set_count,
    (SELECT sum(coalesce(ws.distance_m, 0)) FROM workout_sets ws WHERE ws.session_id = s.id AND ws.done = 1) AS distance,
    (SELECT group_concat(name, char(31)) FROM (
       SELECT e.name FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
       WHERE ws.session_id = s.id GROUP BY ws.exercise_id ORDER BY min(ws.exercise_order))) AS exercise_names
  FROM workout_sessions s`

export function activeSession(db: Database): SessionSummary | null {
  const row = db.selectObjects(`${SUMMARY_SELECT} WHERE s.ended_at IS NULL ORDER BY s.started_at DESC LIMIT 1`)[0]
  return row ? summaryFromRow(row) : null
}

/** Sets from the last finished session that included this exercise (before `beforeSession`). */
function previousSets(db: Database, exerciseId: string, beforeStartedAt: string): PreviousSet[] {
  const last = db.selectValue(
    `SELECT s.id FROM workout_sessions s
     WHERE s.ended_at IS NOT NULL AND s.started_at < ?
       AND EXISTS (SELECT 1 FROM workout_sets ws WHERE ws.session_id = s.id AND ws.exercise_id = ? AND ws.done = 1)
     ORDER BY s.started_at DESC LIMIT 1`,
    [beforeStartedAt, exerciseId],
  )
  if (!last) return []
  return db
    .selectObjects(
      `SELECT weight_kg, reps, duration_s, distance_m FROM workout_sets
       WHERE session_id = ? AND exercise_id = ? AND done = 1 ORDER BY set_order`,
      [String(last), exerciseId],
    )
    .map((r) => ({
      weightKg: num(r.weight_kg),
      reps: num(r.reps),
      durationS: num(r.duration_s),
      distanceM: num(r.distance_m),
    }))
}

/**
 * Suggested weight for a routine item: last time's top weight, plus the increment when
 * every set reached its target reps.
 */
export function suggestWeight(item: RoutineItem, previous: PreviousSet[]): number | null {
  if (!previous.length) return item.weightKg ?? null
  const top = Math.max(...previous.map((s) => s.weightKg ?? 0))
  if (!top) return item.weightKg ?? null
  const target = item.reps ?? 0
  const allHit = target > 0 && previous.length >= item.sets && previous.every((s) => (s.reps ?? 0) >= target)
  return allHit && item.incrementKg ? Math.round((top + item.incrementKg) * 100) / 100 : top
}

function insertSet(
  db: Database,
  p: {
    sessionId: string
    exerciseId: string
    exerciseOrder: number
    setOrder: number
    weightKg?: number | null
    reps?: number | null
    durationS?: number | null
    distanceM?: number | null
    targetReps?: number | null
    restS?: number | null
  },
): void {
  // Sets added to a finished workout count straight away; there's no tick column there.
  const finished = db.selectValue('SELECT ended_at IS NOT NULL FROM workout_sessions WHERE id = ?', [p.sessionId])
  db.exec({
    sql: `INSERT INTO workout_sets (id, session_id, exercise_id, exercise_order, set_order, weight_kg, reps,
            duration_s, distance_m, target_reps, rest_s, done, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [
      newId(),
      p.sessionId,
      p.exerciseId,
      p.exerciseOrder,
      p.setOrder,
      p.weightKg ?? null,
      p.reps ?? null,
      p.durationS ?? null,
      p.distanceM ?? null,
      p.targetReps ?? null,
      p.restS ?? defaultRest(db),
      Number(finished) === 1 ? 1 : 0,
      nowISO(),
    ],
  })
}

export function defaultRest(db: Database): number {
  const v = Number(db.selectValue(`SELECT value FROM app_meta WHERE key = 'workouts.rest_s'`) ?? 90)
  return Number.isFinite(v) && v > 0 ? v : 90
}

/** Starts a workout, empty or from a routine. Only one workout can be in progress. */
export function startSession(
  db: Database,
  p: { today: ISODate; routineId?: string | null; name?: string },
): SessionSummary {
  const running = activeSession(db)
  if (running) return running
  return db.transaction((tx) => {
    const routine = p.routineId ? getRoutine(tx, { id: p.routineId }) : null
    const id = newId()
    const startedAt = nowISO()
    tx.exec({
      sql: `INSERT INTO workout_sessions (id, name, routine_id, day, started_at) VALUES (?, ?, ?, ?, ?)`,
      bind: [id, p.name?.trim() || routine?.name || 'Workout', routine?.id ?? null, p.today, startedAt],
    })
    routine?.items.forEach((item, order) => {
      const exists = tx.selectValue('SELECT 1 FROM exercises WHERE id = ?', [item.exerciseId])
      if (!exists) return
      const prev = previousSets(tx, item.exerciseId, startedAt)
      const weight = suggestWeight(item, prev)
      for (let i = 0; i < item.sets; i++) {
        const last = prev[i] ?? prev.at(-1)
        insertSet(tx, {
          sessionId: id,
          exerciseId: item.exerciseId,
          exerciseOrder: order,
          setOrder: i,
          weightKg: weight,
          reps: item.reps ?? last?.reps ?? null,
          durationS: item.durationS ?? last?.durationS ?? null,
          distanceM: item.distanceM ?? last?.distanceM ?? null,
          targetReps: item.reps ?? null,
          restS: item.restS,
        })
      }
    })
    return summaryFromRow(tx.selectObjects(`${SUMMARY_SELECT} WHERE s.id = ?`, [id])[0]!)
  })
}

function bestsBefore(db: Database, exerciseId: string, startedAt: string) {
  const row = db.selectObjects(
    `SELECT max(ws.weight_kg) AS w, max(CASE WHEN ws.reps = 1 THEN ws.weight_kg ELSE ws.weight_kg * (1 + ws.reps / 30.0) END) AS e1rm, max(ws.reps) AS r,
            max(ws.duration_s) AS d, max(ws.distance_m) AS dist
     FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
     WHERE ws.exercise_id = ? AND ws.done = 1 AND s.ended_at IS NOT NULL AND s.started_at < ?`,
    [exerciseId, startedAt],
  )[0]!
  return {
    weight: num(row.w),
    e1rm: num(row.e1rm),
    reps: num(row.r),
    duration: num(row.d),
    distance: num(row.dist),
  }
}

/** Estimated one-rep max (Epley). */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

function findPRs(db: Database, s: SessionSummary, items: SessionExercise[]): PersonalRecordHit[] {
  const hits: PersonalRecordHit[] = []
  for (const item of items) {
    const done = item.sets.filter((x) => x.done)
    if (!done.length) continue
    const best = bestsBefore(db, item.exercise.id, s.startedAt)
    const hadHistory = Object.values(best).some((v) => v !== null)
    if (!hadHistory) continue
    const push = (setId: string, label: string) =>
      hits.push({ exerciseId: item.exercise.id, exerciseName: item.exercise.name, setId, label })
    const k = item.exercise.kind
    if (k === 'weight') {
      const heaviest = done.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a))
      const strongest = done.reduce((a, b) =>
        e1rm(b.weightKg ?? 0, b.reps ?? 0) > e1rm(a.weightKg ?? 0, a.reps ?? 0) ? b : a,
      )
      if ((heaviest.weightKg ?? 0) > (best.weight ?? 0)) push(heaviest.id, `Heaviest: ${heaviest.weightKg} kg`)
      else if (e1rm(strongest.weightKg ?? 0, strongest.reps ?? 0) > (best.e1rm ?? 0) + 0.01) {
        push(strongest.id, `Best estimated 1RM: ${Math.round(e1rm(strongest.weightKg ?? 0, strongest.reps ?? 0) * 10) / 10} kg`)
      }
    } else if (k === 'reps') {
      const most = done.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a))
      if ((most.reps ?? 0) > (best.reps ?? 0)) push(most.id, `Most reps: ${most.reps}`)
    } else if (k === 'time') {
      const longest = done.reduce((a, b) => ((b.durationS ?? 0) > (a.durationS ?? 0) ? b : a))
      if ((longest.durationS ?? 0) > (best.duration ?? 0)) push(longest.id, 'Longest time')
    } else {
      const farthest = done.reduce((a, b) => ((b.distanceM ?? 0) > (a.distanceM ?? 0) ? b : a))
      if ((farthest.distanceM ?? 0) > (best.distance ?? 0)) {
        push(farthest.id, `Longest distance: ${Math.round((farthest.distanceM ?? 0) / 10) / 100} km`)
      }
    }
  }
  return hits
}

export function getSession(db: Database, p: { id: string }): Session {
  const row = db.selectObjects(`${SUMMARY_SELECT} WHERE s.id = ?`, [p.id])[0]
  if (!row) throw new Error('That workout no longer exists.')
  const summary = summaryFromRow(row)
  const sets = db.selectObjects(
    'SELECT * FROM workout_sets WHERE session_id = ? ORDER BY exercise_order, set_order, created_at',
    [p.id],
  )
  const groups = new Map<string, { order: number; rows: Row[] }>()
  for (const s of sets) {
    const key = String(s.exercise_id)
    const g = groups.get(key) ?? { order: Number(s.exercise_order), rows: [] }
    g.rows.push(s)
    groups.set(key, g)
  }
  const items: SessionExercise[] = [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([exerciseId, g]) => ({
      exercise: getExercise(db, { id: exerciseId }),
      order: g.order,
      sets: g.rows.map(setFromRow),
      previous: previousSets(db, exerciseId, summary.startedAt),
      prSetIds: [],
    }))
  const prs = summary.endedAt ? findPRs(db, summary, items) : []
  for (const hit of prs) items.find((i) => i.exercise.id === hit.exerciseId)?.prSetIds.push(hit.setId)
  return { ...summary, items, prs }
}

function sessionOf(db: Database, setId: string): string {
  const s = db.selectValue('SELECT session_id FROM workout_sets WHERE id = ?', [setId])
  if (!s) throw new Error('That set no longer exists.')
  return String(s)
}

export function addExerciseToSession(db: Database, p: { sessionId: string; exerciseId: string }): void {
  const session = getSession(db, { id: p.sessionId })
  const exercise = getExercise(db, { id: p.exerciseId })
  if (session.items.some((i) => i.exercise.id === exercise.id)) {
    addSet(db, { sessionId: p.sessionId, exerciseId: exercise.id })
    return
  }
  const order = Math.max(-1, ...session.items.map((i) => i.order)) + 1
  const prev = previousSets(db, exercise.id, session.startedAt)
  const count = prev.length || (exercise.kind === 'distance' || exercise.kind === 'time' ? 1 : 3)
  db.transaction((tx) => {
    for (let i = 0; i < count; i++) {
      const last = prev[i] ?? prev.at(-1)
      insertSet(tx, {
        sessionId: p.sessionId,
        exerciseId: exercise.id,
        exerciseOrder: order,
        setOrder: i,
        weightKg: last?.weightKg,
        reps: last?.reps,
        durationS: last?.durationS,
        distanceM: last?.distanceM,
      })
    }
  })
}

/** Adds a set, copying the values of the exercise's last set. */
export function addSet(db: Database, p: { sessionId: string; exerciseId: string }): void {
  const last = db.selectObjects(
    'SELECT * FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_order DESC LIMIT 1',
    [p.sessionId, p.exerciseId],
  )[0]
  if (!last) {
    addExerciseToSession(db, p)
    return
  }
  insertSet(db, {
    sessionId: p.sessionId,
    exerciseId: p.exerciseId,
    exerciseOrder: Number(last.exercise_order),
    setOrder: Number(last.set_order) + 1,
    weightKg: num(last.weight_kg),
    reps: num(last.reps),
    durationS: num(last.duration_s),
    distanceM: num(last.distance_m),
    targetReps: num(last.target_reps),
    restS: Number(last.rest_s),
  })
}

export function updateSet(
  db: Database,
  p: {
    id: string
    weightKg?: number | null
    reps?: number | null
    durationS?: number | null
    distanceM?: number | null
    done?: boolean
  },
): void {
  const row = db.selectObjects('SELECT * FROM workout_sets WHERE id = ?', [p.id])[0]
  if (!row) throw new Error('That set no longer exists.')
  const clean = (v: number | null | undefined, current: SqlValue | undefined, int = false) => {
    if (v === undefined) return current ?? null
    if (v === null || !Number.isFinite(v) || v < 0) return null
    return int ? Math.round(v) : Math.round(v * 100) / 100
  }
  db.exec({
    sql: `UPDATE workout_sets SET weight_kg = ?, reps = ?, duration_s = ?, distance_m = ?, done = ? WHERE id = ?`,
    bind: [
      clean(p.weightKg, row.weight_kg),
      clean(p.reps, row.reps, true),
      clean(p.durationS, row.duration_s, true),
      clean(p.distanceM, row.distance_m),
      p.done === undefined ? Number(row.done) : p.done ? 1 : 0,
      p.id,
    ],
  })
}

export function deleteSet(db: Database, p: { id: string }): void {
  sessionOf(db, p.id)
  db.exec({ sql: 'DELETE FROM workout_sets WHERE id = ?', bind: [p.id] })
}

export function removeExerciseFromSession(db: Database, p: { sessionId: string; exerciseId: string }): void {
  db.exec({
    sql: 'DELETE FROM workout_sets WHERE session_id = ? AND exercise_id = ?',
    bind: [p.sessionId, p.exerciseId],
  })
}

export function moveExerciseInSession(
  db: Database,
  p: { sessionId: string; exerciseId: string; direction: 'up' | 'down' },
): void {
  const order = db
    .selectObjects(
      'SELECT exercise_id, min(exercise_order) AS o FROM workout_sets WHERE session_id = ? GROUP BY exercise_id ORDER BY o',
      [p.sessionId],
    )
    .map((r) => String(r.exercise_id))
  const i = order.indexOf(p.exerciseId)
  const j = p.direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= order.length) return
  ;[order[i], order[j]] = [order[j]!, order[i]!]
  db.transaction((tx) => {
    order.forEach((id, idx) =>
      tx.exec({
        sql: 'UPDATE workout_sets SET exercise_order = ? WHERE session_id = ? AND exercise_id = ?',
        bind: [idx, p.sessionId, id],
      }),
    )
  })
}

export function updateSession(db: Database, p: { id: string; name?: string; notes?: string; day?: ISODate }): void {
  const s = getSession(db, { id: p.id })
  if (p.day !== undefined && !isISODate(p.day)) throw new Error('Invalid date.')
  db.exec({
    sql: 'UPDATE workout_sessions SET name = ?, notes = ?, day = ? WHERE id = ?',
    bind: [p.name?.trim() || s.name, p.notes ?? s.notes, p.day ?? s.day, p.id],
  })
}

/** Ends the workout. Sets that weren't ticked are dropped. Returns the finished workout with its PRs. */
export function finishSession(db: Database, p: { id: string }): Session {
  const s = getSession(db, { id: p.id })
  if (s.endedAt) return s
  if (!s.items.some((i) => i.sets.some((x) => x.done))) {
    throw new Error('Tick at least one set before finishing, or discard the workout.')
  }
  db.transaction((tx) => {
    tx.exec({ sql: 'DELETE FROM workout_sets WHERE session_id = ? AND done = 0', bind: [p.id] })
    tx.exec({ sql: 'UPDATE workout_sessions SET ended_at = ? WHERE id = ?', bind: [nowISO(), p.id] })
  })
  return getSession(db, { id: p.id })
}

export function deleteSession(db: Database, p: { id: string }): void {
  db.exec({ sql: 'DELETE FROM workout_sessions WHERE id = ?', bind: [p.id] })
}

export function listSessions(db: Database, p: { limit?: number; from?: ISODate } = {}): SessionSummary[] {
  return db
    .selectObjects(
      `${SUMMARY_SELECT} WHERE s.ended_at IS NOT NULL ${p.from ? 'AND s.day >= ?' : ''}
       ORDER BY s.day DESC, s.started_at DESC LIMIT ?`,
      p.from ? [p.from, p.limit ?? 200] : [p.limit ?? 200],
    )
    .map(summaryFromRow)
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface ExercisePoint {
  sessionId: string
  day: ISODate
  /** weight: best estimated 1RM · reps: most reps · time: longest seconds · distance: longest km */
  value: number
  /** Heaviest weight (weight exercises), for the history list. */
  topWeight: number | null
  sets: { weightKg: number | null; reps: number | null; durationS: number | null; distanceM: number | null }[]
}

export interface ExerciseProgress {
  exercise: Exercise
  points: ExercisePoint[]
  records: { label: string; value: string; day: ISODate | null }[]
}

export function exerciseProgress(db: Database, p: { id: string; limit?: number }): ExerciseProgress {
  const exercise = getExercise(db, { id: p.id })
  const rows = db.selectObjects(
    `SELECT s.id AS session_id, s.day, ws.weight_kg, ws.reps, ws.duration_s, ws.distance_m
     FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
     WHERE ws.exercise_id = ? AND ws.done = 1 AND s.ended_at IS NOT NULL
     ORDER BY s.started_at, ws.set_order`,
    [p.id],
  )
  const bySession = new Map<string, ExercisePoint>()
  for (const r of rows) {
    const id = String(r.session_id)
    const point = bySession.get(id) ?? { sessionId: id, day: String(r.day), value: 0, topWeight: null, sets: [] }
    const set = {
      weightKg: num(r.weight_kg),
      reps: num(r.reps),
      durationS: num(r.duration_s),
      distanceM: num(r.distance_m),
    }
    point.sets.push(set)
    const v =
      exercise.kind === 'weight'
        ? e1rm(set.weightKg ?? 0, set.reps ?? 0)
        : exercise.kind === 'reps'
          ? set.reps ?? 0
          : exercise.kind === 'time'
            ? set.durationS ?? 0
            : (set.distanceM ?? 0) / 1000
    point.value = Math.max(point.value, Math.round(v * 100) / 100)
    if (set.weightKg != null) point.topWeight = Math.max(point.topWeight ?? 0, set.weightKg)
    bySession.set(id, point)
  }
  const points = [...bySession.values()].slice(-(p.limit ?? 100))
  const all = [...bySession.values()]
  const best = <T>(pick: (pt: ExercisePoint) => T | null, better: (a: T, b: T) => boolean) => {
    let top: { v: T; day: ISODate } | null = null
    for (const pt of all) {
      const v = pick(pt)
      if (v !== null && (top === null || better(v, top.v))) top = { v, day: pt.day }
    }
    return top
  }
  const records: ExerciseProgress['records'] = []
  if (exercise.kind === 'weight') {
    const w = best((pt) => pt.topWeight, (a, b) => a > b)
    const e = best((pt) => pt.value || null, (a, b) => a > b)
    const v = best(
      (pt) => Math.max(...pt.sets.map((s) => (s.weightKg ?? 0) * (s.reps ?? 0))) || null,
      (a, b) => a > b,
    )
    if (w) records.push({ label: 'Heaviest weight', value: `${w.v} kg`, day: w.day })
    if (e) records.push({ label: 'Best estimated 1RM', value: `${Math.round(e.v * 10) / 10} kg`, day: e.day })
    if (v) records.push({ label: 'Best set (kg × reps)', value: `${Math.round(v.v)} kg`, day: v.day })
  } else if (exercise.kind === 'reps') {
    const r = best((pt) => pt.value || null, (a, b) => a > b)
    if (r) records.push({ label: 'Most reps in a set', value: String(r.v), day: r.day })
  } else if (exercise.kind === 'time') {
    const t = best((pt) => pt.value || null, (a, b) => a > b)
    if (t) records.push({ label: 'Longest', value: formatDuration(t.v), day: t.day })
  } else {
    const d = best((pt) => pt.value || null, (a, b) => a > b)
    const pace = best(
      (pt) => {
        const s = pt.sets.find((x) => (x.distanceM ?? 0) >= 1000 && (x.durationS ?? 0) > 0)
        return s ? (s.durationS! / s.distanceM!) * 1000 : null
      },
      (a, b) => a < b,
    )
    if (d) records.push({ label: 'Longest distance', value: `${d.v} km`, day: d.day })
    if (pace) records.push({ label: 'Fastest pace (1 km or more)', value: `${formatDuration(Math.round(pace.v))} /km`, day: pace.day })
  }
  records.push({ label: 'Times done', value: String(all.length), day: null })
  return { exercise, points, records }
}

export interface WorkoutStats {
  thisWeek: number
  thisMonth: number
  /** Consecutive weeks (ending this or last week) with at least one workout. */
  weekStreak: number
  /** Completed sets per week, oldest first, for the last `weeks` weeks. */
  weekly: { weekStart: ISODate; sets: number; sessions: number }[]
  /** Completed sets per muscle group this week and last week. */
  muscles: { muscle: string; thisWeek: number; lastWeek: number }[]
}

export function workoutStats(db: Database, p: { today: ISODate; weeks?: number }): WorkoutStats {
  const weeks = p.weeks ?? 8
  const monday = startOfWeek(p.today)
  const from = addDays(monday, -7 * (weeks - 1))
  const rows = db.selectObjects(
    `SELECT s.id, s.day, count(ws.id) AS sets FROM workout_sessions s
     LEFT JOIN workout_sets ws ON ws.session_id = s.id AND ws.done = 1
     WHERE s.ended_at IS NOT NULL GROUP BY s.id`,
  )
  const weekly = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(from, i * 7), sets: 0, sessions: 0 }))
  const activeWeeks = new Set<string>()
  for (const r of rows) {
    const day = String(r.day)
    activeWeeks.add(startOfWeek(day))
    const idx = weekly.findIndex((w) => w.weekStart === startOfWeek(day))
    if (idx >= 0) {
      weekly[idx]!.sets += Number(r.sets)
      weekly[idx]!.sessions += 1
    }
  }
  let streak = 0
  let w = activeWeeks.has(monday) ? monday : addDays(monday, -7)
  while (activeWeeks.has(w)) {
    streak++
    w = addDays(w, -7)
  }
  const monthStart = `${p.today.slice(0, 7)}-01`
  const thisMonth = rows.filter((r) => String(r.day) >= monthStart && String(r.day) <= p.today).length
  const muscleRows = db.selectObjects(
    `SELECT e.muscle, sum(s.day >= ?) AS this_week, sum(s.day < ?) AS last_week
     FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.done = 1 AND s.ended_at IS NOT NULL AND s.day >= ? AND s.day <= ?
     GROUP BY e.muscle ORDER BY this_week DESC, last_week DESC`,
    [monday, monday, addDays(monday, -7), p.today],
  )
  return {
    thisWeek: weekly.at(-1)?.sessions ?? 0,
    thisMonth,
    weekStreak: streak,
    weekly,
    muscles: muscleRows.map((r) => ({
      muscle: String(r.muscle || 'Other'),
      thisWeek: Number(r.this_week ?? 0),
      lastWeek: Number(r.last_week ?? 0),
    })),
  }
}

export interface PlannedWorkout {
  routine: Routine
  doneToday: boolean
}

/** Routines scheduled for today's weekday, and whether each was already done today. */
export function plannedWorkouts(db: Database, p: { today: ISODate }): PlannedWorkout[] {
  const wd = weekday(p.today)
  return listRoutines(db)
    .filter((r) => r.weekdays.includes(wd))
    .map((routine) => ({
      routine,
      doneToday: Boolean(
        db.selectValue(
          'SELECT 1 FROM workout_sessions WHERE routine_id = ? AND day = ? AND ended_at IS NOT NULL',
          [routine.id, p.today],
        ),
      ),
    }))
}

// ── Body weight ─────────────────────────────────────────────────────────────

export interface BodyWeight {
  day: ISODate
  weightKg: number
}

export function logBodyWeight(db: Database, p: { day: ISODate; weightKg: number | null }): void {
  if (!isISODate(p.day)) throw new Error('Invalid date.')
  if (p.weightKg === null) {
    db.exec({ sql: 'DELETE FROM body_weights WHERE day = ?', bind: [p.day] })
    return
  }
  if (!Number.isFinite(p.weightKg) || p.weightKg < 20 || p.weightKg > 400) {
    throw new Error('Enter a weight in kg between 20 and 400.')
  }
  db.exec({
    sql: `INSERT INTO body_weights (day, weight_kg, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(day) DO UPDATE SET weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`,
    bind: [p.day, Math.round(p.weightKg * 10) / 10, nowISO()],
  })
}

export function bodyWeights(db: Database, p: { from?: ISODate } = {}): BodyWeight[] {
  return db
    .selectObjects(
      `SELECT day, weight_kg FROM body_weights ${p.from ? 'WHERE day >= ?' : ''} ORDER BY day`,
      p.from ? [p.from] : [],
    )
    .map((r) => ({ day: String(r.day), weightKg: Number(r.weight_kg) }))
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`
}

/** "1:15" → 75, "90" → 5400 (minutes), "1:02:05" → 3725. Returns null if it can't be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(':').map((x) => Number(x))
  if (parts.some((x) => !Number.isFinite(x) || x < 0)) return null
  if (parts.length === 1) return Math.round(parts[0]! * 60)
  if (parts.length === 2) return Math.round(parts[0]! * 60 + parts[1]!)
  if (parts.length === 3) return Math.round(parts[0]! * 3600 + parts[1]! * 60 + parts[2]!)
  return null
}
