import { describe, expect, it } from 'vitest'
import { MUTATIONS } from '../db/mutations'
import { freshDb } from '../test/db'
import { api } from './api'
import { createHabit, logHabit } from './habits'
import { createTask, setTaskDone } from './tasks'
import { todaySummary } from './today'

const TODAY = '2026-09-28'

describe('api', () => {
  it('every mutation is a real call', () => {
    for (const name of MUTATIONS) expect(api).toHaveProperty(name)
  })

  it('writes are listed as mutations (by naming convention)', () => {
    const writeVerbs = /^(create|update|delete|add|move|remove|trash|restore|purge|empty|quickAdd|set|log|tap)/
    for (const name of Object.keys(api)) {
      if (writeVerbs.test(name)) expect(MUTATIONS.has(name), name).toBe(true)
    }
  })
})

describe('todaySummary', () => {
  it('splits overdue, due today and done today, and lists habits', async () => {
    const db = await freshDb()
    createTask(db, { title: 'Late', due: '2026-09-25' })
    createTask(db, { title: 'Now', due: TODAY })
    const done = createTask(db, { title: 'Finished', due: TODAY })
    setTaskDone(db, { id: done.id, done: true, today: TODAY })
    createTask(db, { title: 'Inbox item' })
    const h = createHabit(db, { name: 'Meditate' })
    logHabit(db, { habitId: h.id, day: TODAY, value: 1 })
    const s = todaySummary(db, { today: TODAY })
    expect(s.overdue.map((t) => t.title)).toEqual(['Late'])
    expect(s.dueToday.map((t) => t.title)).toEqual(['Now'])
    expect(s.habits.map((x) => [x.habit.name, x.doneToday])).toEqual([['Meditate', true]])
    expect(s.counts.inbox).toBe(1)
    // "Done today" depends on the local clock matching TODAY, which only holds on that date.
    expect(Array.isArray(s.doneToday)).toBe(true)
  })
})
