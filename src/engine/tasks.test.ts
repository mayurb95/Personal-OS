import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import { addDays, formatDay, formatTime, startOfWeek, weekday } from './dates'
import { parseQuickAdd } from './quickadd'
import { describeRecurrence, nextDueAfterCompletion, nextOccurrence } from './recurrence'
import {
  createTask,
  listProjects,
  listTaskTags,
  listTasks,
  quickAddTask,
  setTaskDone,
  taskCounts,
  updateTask,
} from './tasks'

// Monday 28 September 2026.
const TODAY = '2026-09-28'

describe('dates', () => {
  it('does calendar arithmetic on date strings', () => {
    expect(weekday(TODAY)).toBe(0)
    expect(addDays(TODAY, 5)).toBe('2026-10-03')
    expect(startOfWeek('2026-10-04')).toBe(TODAY)
    expect(formatDay(TODAY, TODAY)).toBe('Today')
    expect(formatDay('2026-09-29', TODAY)).toBe('Tomorrow')
    expect(formatDay('2026-10-02', TODAY)).toBe('Friday')
    expect(formatDay('2026-10-12', TODAY)).toBe('12 Oct')
    expect(formatDay('2027-01-05', TODAY)).toBe('5 Jan 2027')
    expect(formatTime('17:05')).toBe('5:05 pm')
    expect(formatTime('00:30')).toBe('12:30 am')
  })
})

describe('parseQuickAdd', () => {
  it('reads the PRD example', () => {
    expect(parseQuickAdd('Submit tariff comments Fri 5pm #work p1', TODAY)).toEqual({
      title: 'Submit tariff comments',
      due: '2026-10-02',
      time: '17:00',
      priority: 1,
      tags: ['work'],
    })
  })

  it.each([
    ['Call mom tomorrow at 7:30pm', { title: 'Call mom', due: '2026-09-29', time: '19:30' }],
    ['Report due 12 oct', { title: 'Report', due: '2026-10-12' }],
    ['Renew passport 15/3', { title: 'Renew passport', due: '2027-03-15' }],
    ['Read in 3 days', { title: 'Read', due: '2026-10-01' }],
    ['next fri review', { title: 'review', due: '2026-10-09' }],
    ['Meeting at 14:30', { title: 'Meeting', due: TODAY, time: '14:30' }],
    ['Budget review mon', { title: 'Budget review', due: TODAY }],
    ['Lunch noon today', { title: 'Lunch', due: TODAY, time: '12:00' }],
    ['File return on Oct 31 2026', { title: 'File return', due: '2026-10-31' }],
    ['Buy milk', { title: 'Buy milk' }],
  ])('%s', (input, expected) => {
    expect(parseQuickAdd(input, TODAY)).toMatchObject(expected)
  })

  it('reads repeat rules and places the first occurrence', () => {
    expect(parseQuickAdd('Gym every mon, wed and fri', TODAY)).toMatchObject({
      title: 'Gym',
      due: TODAY,
      recurrence: { freq: 'week', interval: 1, weekdays: [0, 2, 4] },
    })
    expect(parseQuickAdd('Water plants every 3 days', TODAY)).toMatchObject({
      title: 'Water plants',
      due: TODAY,
      recurrence: { freq: 'day', interval: 3 },
    })
    expect(parseQuickAdd('Standup every weekday 9:30am', TODAY)).toMatchObject({
      title: 'Standup',
      time: '09:30',
      recurrence: { freq: 'week', weekdays: [0, 1, 2, 3, 4] },
    })
    expect(parseQuickAdd('Pay rent monthly', TODAY).recurrence).toEqual({ freq: 'month', interval: 1 })
    expect(parseQuickAdd('Review every thursday', TODAY).due).toBe('2026-10-01')
  })

  it('keeps several tags and ignores invalid dates', () => {
    const r = parseQuickAdd('Draft #work #tariff 31/2', TODAY)
    expect(r.tags).toEqual(['work', 'tariff'])
    expect(r.due).toBeUndefined()
    expect(r.title).toBe('Draft 31/2')
  })
})

describe('recurrence', () => {
  it('finds the next occurrence', () => {
    expect(nextOccurrence({ freq: 'day', interval: 2 }, TODAY)).toBe('2026-09-30')
    expect(nextOccurrence({ freq: 'week', interval: 1 }, TODAY)).toBe('2026-10-05')
    expect(nextOccurrence({ freq: 'week', interval: 1, weekdays: [0, 3] }, TODAY)).toBe('2026-10-01')
    expect(nextOccurrence({ freq: 'week', interval: 2, weekdays: [0, 3] }, '2026-10-01')).toBe('2026-10-12')
    expect(nextOccurrence({ freq: 'month', interval: 1 }, '2026-01-31')).toBe('2026-02-28')
  })

  it('moves an overdue repeating task past today', () => {
    expect(nextDueAfterCompletion({ freq: 'day', interval: 1 }, '2026-09-20', TODAY)).toBe('2026-09-29')
    expect(nextDueAfterCompletion({ freq: 'week', interval: 1 }, '2026-10-05', TODAY)).toBe('2026-10-12')
    expect(
      nextDueAfterCompletion({ freq: 'day', interval: 3, fromCompletion: true }, '2026-09-01', TODAY),
    ).toBe('2026-10-01')
  })

  it('describes rules in plain words', () => {
    expect(describeRecurrence({ freq: 'day', interval: 1 })).toBe('Every day')
    expect(describeRecurrence({ freq: 'week', interval: 1, weekdays: [0, 1, 2, 3, 4] })).toBe('Every weekday')
    expect(describeRecurrence({ freq: 'week', interval: 1 }, '2026-10-02')).toBe('Every Fri')
    expect(describeRecurrence({ freq: 'month', interval: 1 }, '2026-10-05')).toBe('Every month on the 5th')
    expect(describeRecurrence({ freq: 'day', interval: 3, fromCompletion: true })).toBe('3 days after completion')
  })
})

describe('tasks', () => {
  let db: Database
  beforeEach(async () => {
    db = await freshDb()
  })

  it('quick-adds and lists tasks in the right lists', () => {
    quickAddTask(db, { text: 'Overdue thing yesterday', today: TODAY })
    // "yesterday" isn't a keyword, so this one lands in the inbox with the word kept.
    quickAddTask(db, { text: 'Pay bill today p2', today: TODAY })
    quickAddTask(db, { text: 'Later task in 5 days', today: TODAY })
    createTask(db, { title: 'Project work', project: 'Tariff study' })
    createTask(db, { title: 'Learn guitar', someday: true })
    createTask(db, { title: 'Old', due: '2026-09-20' })

    expect(listTasks(db, { list: 'today', today: TODAY }).map((t) => t.title)).toEqual(['Old', 'Pay bill'])
    expect(listTasks(db, { list: 'upcoming', today: TODAY }).map((t) => t.title)).toEqual(['Later task'])
    expect(listTasks(db, { list: 'inbox', today: TODAY }).map((t) => t.title)).toEqual(['Overdue thing yesterday'])
    expect(listTasks(db, { list: 'someday', today: TODAY }).map((t) => t.title)).toEqual(['Learn guitar'])
    expect(listTasks(db, { list: 'project', project: 'tariff study', today: TODAY })).toHaveLength(0)
    expect(listTasks(db, { list: 'project', project: 'Tariff study', today: TODAY })).toHaveLength(1)
    expect(taskCounts(db, { today: TODAY })).toEqual({
      today: 2,
      overdue: 1,
      upcoming: 1,
      inbox: 1,
      someday: 1,
      all: 6,
    })
  })

  it('sorts by due date, time, then priority', () => {
    createTask(db, { title: 'C', due: TODAY, priority: 3 })
    createTask(db, { title: 'A', due: TODAY, time: '09:00' })
    createTask(db, { title: 'B', due: TODAY, priority: 1 })
    expect(listTasks(db, { list: 'today', today: TODAY }).map((t) => t.title)).toEqual(['A', 'B', 'C'])
  })

  it('completes, reopens and lists done tasks', () => {
    const t = createTask(db, { title: 'Send report', due: TODAY })
    const { task, next } = setTaskDone(db, { id: t.id, done: true, today: TODAY })
    expect(task.done).toBe(true)
    expect(task.completedAt).not.toBeNull()
    expect(next).toBeNull()
    expect(listTasks(db, { list: 'today', today: TODAY })).toHaveLength(0)
    expect(listTasks(db, { list: 'done', today: TODAY })).toHaveLength(1)
    const reopened = setTaskDone(db, { id: t.id, done: false, today: TODAY }).task
    expect(reopened.done).toBe(false)
    expect(reopened.completedAt).toBeNull()
  })

  it('creates the next copy when a repeating task is completed', () => {
    const t = quickAddTask(db, { text: 'Standup every weekday #work', today: TODAY })
    const { task, next } = setTaskDone(db, { id: t.id, done: true, today: TODAY })
    expect(task.recurrence).toBeNull()
    expect(next).toMatchObject({ title: 'Standup', due: '2026-09-29', tags: ['work'] })
    expect(next!.recurrence).toMatchObject({ freq: 'week' })
  })

  it('updates fields, clears time with the date, and remembers projects and tags', () => {
    const t = createTask(db, { title: 'Draft', due: TODAY, time: '10:00' })
    let u = updateTask(db, { id: t.id, priority: 2, project: 'Open access', tags: ['Work', '#reading'] })
    expect(u).toMatchObject({ priority: 2, project: 'Open access', tags: ['Work', 'reading'], time: '10:00' })
    u = updateTask(db, { id: t.id, due: null })
    expect(u.due).toBeNull()
    expect(u.time).toBeNull()
    u = updateTask(db, { id: t.id, tags: ['work'] })
    expect(u.tags).toEqual(['Work'])
    expect(listProjects(db)).toEqual([{ name: 'Open access', open: 1 }])
    expect(listTaskTags(db)).toEqual(['reading', 'Work'])
  })

  it('refuses empty titles', () => {
    expect(() => createTask(db, { title: '  ' })).toThrow()
    expect(() => quickAddTask(db, { text: 'today p1', today: TODAY })).toThrow()
  })
})
