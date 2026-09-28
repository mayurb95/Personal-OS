/** The built-in Tasks module, stored as records in the 'tasks' collection. */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { nowISO } from './clock'
import { ensureChoice } from './collections'
import { addDays, daysBetween, type ISODate, isISODate } from './dates'
import { parseQuickAdd } from './quickadd'
import { isRecurrence, nextDueAfterCompletion, type Recurrence } from './recurrence'
import { createRecord, recordFromRow, requireRecord, updateRecord } from './records'
import type { RecordData, RecordItem } from './types'

export const TASKS = 'tasks'

export type Priority = 1 | 2 | 3 | 4

export interface Task {
  id: string
  title: string
  notes: string
  due: ISODate | null
  time: string | null
  priority: Priority | null
  project: string | null
  tags: string[]
  someday: boolean
  done: boolean
  completedAt: string | null
  recurrence: Recurrence | null
  createdAt: string
}

export function taskFromRecord(r: RecordItem): Task {
  const d = r.data
  const priority = Number(d.priority)
  return {
    id: r.id,
    title: r.title,
    notes: r.body,
    due: isISODate(d.due) ? d.due : null,
    time: typeof d.time === 'string' && /^\d{2}:\d{2}$/.test(d.time) ? d.time : null,
    priority: priority >= 1 && priority <= 4 ? (priority as Priority) : null,
    project: typeof d.project === 'string' && d.project ? d.project : null,
    tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
    someday: d.someday === true,
    done: d.done === true,
    completedAt: typeof d.completed_at === 'string' ? d.completed_at : null,
    recurrence: isRecurrence(d.recurrence) ? d.recurrence : null,
    createdAt: r.createdAt,
  }
}

export interface TaskInput {
  title?: string
  notes?: string
  due?: ISODate | null
  time?: string | null
  priority?: Priority | null
  project?: string | null
  tags?: string[]
  someday?: boolean
  recurrence?: Recurrence | null
}

function toData(db: Database, input: TaskInput): RecordData {
  const data: RecordData = {}
  if (input.due !== undefined) data.due = input.due
  if (input.time !== undefined) data.time = input.time
  if (input.priority !== undefined) data.priority = input.priority
  if (input.project !== undefined) {
    data.project = input.project?.trim() ? ensureChoice(db, 'tasks.project', input.project) : null
  }
  if (input.tags !== undefined) {
    data.tags = input.tags.map((t) => ensureChoice(db, 'tasks.tags', t.replace(/^#/, '')))
  }
  if (input.someday !== undefined) data.someday = input.someday || null
  if (input.recurrence !== undefined) data.recurrence = input.recurrence as unknown as RecordData[string]
  // A task with a date isn't "someday".
  if (input.due) data.someday = null
  return data
}

export function createTask(db: Database, p: TaskInput & { title: string }): Task {
  const title = p.title.trim()
  if (!title) throw new Error('Type what needs doing.')
  const r = createRecord(db, {
    collectionId: TASKS,
    title,
    body: p.notes ?? '',
    data: toData(db, p),
  })
  return taskFromRecord(r)
}

export function quickAddTask(
  db: Database,
  p: { text: string; today: ISODate; defaults?: TaskInput },
): Task {
  const parsed = parseQuickAdd(p.text, p.today)
  if (!parsed.title) throw new Error('Type what needs doing.')
  return createTask(db, {
    ...p.defaults,
    title: parsed.title,
    due: parsed.due ?? p.defaults?.due ?? null,
    time: parsed.time ?? null,
    priority: parsed.priority ?? p.defaults?.priority ?? null,
    tags: [...(p.defaults?.tags ?? []), ...parsed.tags],
    recurrence: parsed.recurrence ?? null,
  })
}

export function getTask(db: Database, p: { id: string }): Task {
  const r = requireRecord(db, p.id)
  if (r.collectionId !== TASKS) throw new Error('That item isn’t a task.')
  return taskFromRecord(r)
}

export function updateTask(db: Database, p: { id: string } & TaskInput): Task {
  const data = toData(db, p)
  if (p.due === null) data.time = null
  return taskFromRecord(
    updateRecord(db, { id: p.id, title: p.title, body: p.notes, data }),
  )
}

/**
 * Ticks a task off (or back on). Completing a repeating task keeps the completed copy
 * for the record and creates the next one with its new due date.
 */
export function setTaskDone(
  db: Database,
  p: { id: string; done: boolean; today: ISODate },
): { task: Task; next: Task | null } {
  return db.transaction((tx) => {
    const task = getTask(tx, { id: p.id })
    if (task.done === p.done) return { task, next: null }
    if (!p.done) {
      const reopened = taskFromRecord(
        updateRecord(tx, { id: p.id, data: { done: null, completed_at: null } }),
      )
      return { task: reopened, next: null }
    }
    let next: Task | null = null
    if (task.recurrence) {
      next = createTask(tx, {
        title: task.title,
        notes: task.notes,
        due: nextDueAfterCompletion(task.recurrence, task.due, p.today),
        time: task.time,
        priority: task.priority,
        project: task.project,
        tags: task.tags,
        recurrence: task.recurrence,
      })
    }
    const done = taskFromRecord(
      updateRecord(tx, {
        id: p.id,
        // The finished copy no longer repeats; the new copy carries the rule.
        data: { done: true, completed_at: nowISO(), recurrence: null },
      }),
    )
    return { task: done, next }
  })
}

export type TaskList = 'today' | 'upcoming' | 'inbox' | 'someday' | 'all' | 'done' | 'project' | 'tag'

const OPEN = `collection_id = 'tasks' AND deleted_at IS NULL AND json_extract(data, '$.done') IS NOT 1`
const ORDER = `json_extract(data, '$.due') IS NULL, json_extract(data, '$.due'),
  json_extract(data, '$.time') IS NULL, json_extract(data, '$.time'),
  coalesce(json_extract(data, '$.priority'), 5), created_at`

export function listTasks(
  db: Database,
  p: { list: TaskList; today: ISODate; project?: string; tag?: string },
): Task[] {
  let sql: string
  const bind: (string | number)[] = []
  switch (p.list) {
    case 'today':
      sql = `SELECT * FROM records WHERE ${OPEN} AND json_extract(data, '$.due') <= ? ORDER BY ${ORDER}`
      bind.push(p.today)
      break
    case 'upcoming':
      sql = `SELECT * FROM records WHERE ${OPEN} AND json_extract(data, '$.due') > ? ORDER BY ${ORDER}`
      bind.push(p.today)
      break
    case 'inbox':
      sql = `SELECT * FROM records WHERE ${OPEN} AND json_extract(data, '$.due') IS NULL
             AND json_extract(data, '$.project') IS NULL AND json_extract(data, '$.someday') IS NOT 1
             ORDER BY created_at DESC`
      break
    case 'someday':
      sql = `SELECT * FROM records WHERE ${OPEN} AND json_extract(data, '$.someday') = 1 ORDER BY created_at DESC`
      break
    case 'project':
      sql = `SELECT * FROM records WHERE ${OPEN} AND json_extract(data, '$.project') = ? ORDER BY ${ORDER}`
      bind.push(p.project ?? '')
      break
    case 'tag':
      sql = `SELECT * FROM records WHERE ${OPEN}
             AND EXISTS (SELECT 1 FROM json_each(data, '$.tags') WHERE lower(value) = lower(?))
             ORDER BY ${ORDER}`
      bind.push(p.tag ?? '')
      break
    case 'done':
      sql = `SELECT * FROM records WHERE collection_id = 'tasks' AND deleted_at IS NULL
             AND json_extract(data, '$.done') = 1 AND json_extract(data, '$.completed_at') >= ?
             ORDER BY json_extract(data, '$.completed_at') DESC`
      bind.push(addDays(p.today, -30))
      break
    default:
      sql = `SELECT * FROM records WHERE ${OPEN} ORDER BY ${ORDER}`
  }
  return db.selectObjects(sql, bind).map((row) => taskFromRecord(recordFromRow(row)))
}

export interface TaskCounts {
  today: number
  overdue: number
  upcoming: number
  inbox: number
  someday: number
  all: number
}

export function taskCounts(db: Database, p: { today: ISODate }): TaskCounts {
  const row = db.selectObjects(
    `SELECT
       sum(json_extract(data, '$.due') <= ?) AS today,
       sum(json_extract(data, '$.due') < ?) AS overdue,
       sum(json_extract(data, '$.due') > ?) AS upcoming,
       sum(json_extract(data, '$.due') IS NULL AND json_extract(data, '$.project') IS NULL
           AND json_extract(data, '$.someday') IS NOT 1) AS inbox,
       sum(json_extract(data, '$.someday') = 1) AS someday,
       count(*) AS all_open
     FROM records WHERE ${OPEN}`,
    [p.today, p.today, p.today],
  )[0]!
  return {
    today: Number(row.today ?? 0),
    overdue: Number(row.overdue ?? 0),
    upcoming: Number(row.upcoming ?? 0),
    inbox: Number(row.inbox ?? 0),
    someday: Number(row.someday ?? 0),
    all: Number(row.all_open ?? 0),
  }
}

export interface ProjectSummary {
  name: string
  open: number
}

/** Every project that has a name, with its number of open tasks (including empty projects). */
export function listProjects(db: Database): ProjectSummary[] {
  const counts = new Map<string, number>(
    db
      .selectObjects(
        `SELECT json_extract(data, '$.project') AS p, count(*) AS n FROM records
         WHERE ${OPEN} AND json_extract(data, '$.project') IS NOT NULL GROUP BY p`,
      )
      .map((r) => [String(r.p), Number(r.n)]),
  )
  const options = db.selectValue(`SELECT options FROM fields WHERE id = 'tasks.project'`)
  const choices = (JSON.parse(String(options ?? '{}')) as { choices?: { label: string }[] }).choices ?? []
  const names = new Set([...choices.map((c) => c.label), ...counts.keys()])
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map((name) => ({ name, open: counts.get(name) ?? 0 }))
}

export function listTaskTags(db: Database): string[] {
  const options = db.selectValue(`SELECT options FROM fields WHERE id = 'tasks.tags'`)
  const choices = (JSON.parse(String(options ?? '{}')) as { choices?: { label: string }[] }).choices ?? []
  return choices.map((c) => c.label).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/** How overdue a task is, in days (0 when due today or later). */
export function daysOverdue(task: Task, today: ISODate): number {
  return task.due ? Math.max(0, daysBetween(task.due, today)) : 0
}
