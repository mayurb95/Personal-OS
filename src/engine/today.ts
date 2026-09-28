/** Everything the Today screen needs, in one call. */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { type ISODate, localDate } from './dates'
import { type HabitStatus, listHabits } from './habits'
import { listTasks, type Task, taskCounts, type TaskCounts } from './tasks'

export interface TodaySummary {
  overdue: Task[]
  dueToday: Task[]
  /** Tasks ticked off today, so they stay visible (struck through) until tomorrow. */
  doneToday: Task[]
  habits: HabitStatus[]
  counts: TaskCounts
}

export function todaySummary(db: Database, p: { today: ISODate }): TodaySummary {
  const open = listTasks(db, { list: 'today', today: p.today })
  const doneToday = listTasks(db, { list: 'done', today: p.today }).filter(
    (t) => t.completedAt !== null && localDate(new Date(t.completedAt)) === p.today && t.due !== null,
  )
  return {
    overdue: open.filter((t) => t.due! < p.today),
    dueToday: open.filter((t) => t.due === p.today),
    doneToday,
    habits: listHabits(db, { today: p.today }).filter(
      (s) => s.scheduledToday || s.habit.kind === 'limit' || s.today !== null,
    ),
    counts: taskCounts(db, { today: p.today }),
  }
}
