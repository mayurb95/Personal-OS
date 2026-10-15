import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import { clock } from './clock'
import { addDays } from './dates'
import { createHabit, logHabit } from './habits'
import {
  DEFAULT_PROMPTS,
  getEntry,
  journalDay,
  journalStats,
  listEntries,
  moodByHabit,
  onThisDay,
  promptFor,
  saveEntry,
  setJournalPrompts,
} from './journal'
import { search } from './records'

const TODAY = '2026-10-15'
let db: Database
const realNow = clock.now

beforeEach(async () => {
  db = await freshDb()
})
afterEach(() => {
  clock.now = realNow
})

describe('journal', () => {
  it('keeps one entry per day and updates it in place', () => {
    const a = saveEntry(db, { day: TODAY, text: 'Long day of tariff hearings.', mood: 3 })!
    const b = saveEntry(db, { day: TODAY, emotions: ['Tired', 'Focused'] })!
    expect(b.id).toBe(a.id)
    expect(b).toMatchObject({ text: 'Long day of tariff hearings.', mood: 3, emotions: ['Tired', 'Focused'] })
    expect(listEntries(db)).toHaveLength(1)
    expect(search(db, { query: 'hearings' })[0]!.collectionKind).toBe('journal')
  })

  it('removes an entry that becomes empty', () => {
    saveEntry(db, { day: TODAY, mood: 4 })
    expect(saveEntry(db, { day: TODAY, mood: null })).toBeNull()
    expect(getEntry(db, { day: TODAY })).toBeNull()
    expect(saveEntry(db, { day: TODAY, text: 'Again' })).not.toBeNull()
  })

  it('gives each day a steady prompt and stores it with the entry', () => {
    expect(promptFor(DEFAULT_PROMPTS, TODAY)).toBe(promptFor(DEFAULT_PROMPTS, TODAY))
    expect(promptFor(DEFAULT_PROMPTS, TODAY)).not.toBe(promptFor(DEFAULT_PROMPTS, addDays(TODAY, 1)))
    setJournalPrompts(db, { prompts: ['Only one?', ' ', 'Only one?'] })
    expect(journalDay(db, { day: TODAY }).prompt).toBe('Only one?')
    saveEntry(db, { day: TODAY, text: 'x', prompt: 'Kept' })
    expect(journalDay(db, { day: TODAY }).prompt).toBe('Kept')
  })

  it('finds entries from a month, six months and years ago', () => {
    saveEntry(db, { day: '2026-09-15', text: 'Month' })
    saveEntry(db, { day: '2026-04-15', text: 'Six' })
    saveEntry(db, { day: '2025-10-15', text: 'Year' })
    saveEntry(db, { day: '2026-10-14', text: 'Yesterday' })
    expect(onThisDay(db, { day: TODAY }).map((o) => o.label)).toEqual(['A month ago', 'Six months ago', 'A year ago'])
  })

  it('counts a writing streak and average mood', () => {
    for (let i = 1; i <= 4; i++) saveEntry(db, { day: addDays(TODAY, -i), mood: i % 2 ? 4 : 2 })
    saveEntry(db, { day: addDays(TODAY, -7), mood: 5 })
    const s = journalStats(db, { today: TODAY })
    expect(s.streak).toBe(4)
    expect(s.entries30).toBe(5)
    expect(s.avgMood30).toBe(3.4)
    expect(s.mood.map((m) => m.mood)).toEqual([5, 2, 4, 2, 4])
  })

  it('compares mood on days a habit was done and not done', () => {
    clock.now = () => new Date('2026-09-01T06:00:00Z')
    const gym = createHabit(db, { name: 'Gym' })
    for (let i = 1; i <= 8; i++) {
      const day = addDays(TODAY, -i)
      const did = i % 2 === 0
      if (did) logHabit(db, { habitId: gym.id, day, value: 1 })
      saveEntry(db, { day, mood: did ? 5 : 3 })
    }
    expect(moodByHabit(db, { today: TODAY })).toEqual([
      { habit: 'Gym', doneDays: 4, otherDays: 4, moodDone: 5, moodOther: 3 },
    ])
  })
})
