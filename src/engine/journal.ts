/**
 * Journal: one entry per day (records in the built-in 'journal' collection) with mood,
 * energy and feelings, plus prompts, "on this day" and how mood relates to habits.
 */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { addDays, addMonths, daysBetween, formatDayWithWeekday, type ISODate, isISODate } from './dates'
import { nowISO } from './clock'
import { habitFromRecord, isDone, isScheduled } from './habits'
import { createRecord, purgeRecord, recordFromRow, updateRecord } from './records'
import type { RecordItem } from './types'

export const JOURNAL = 'journal'

export interface JournalEntry {
  id: string
  day: ISODate
  text: string
  mood: number | null
  energy: number | null
  emotions: string[]
  prompt: string | null
  updatedAt: string
}

export const DEFAULT_PROMPTS = [
  'What went well today?',
  'What’s one thing you’d do differently?',
  'What are you grateful for today?',
  'What took most of your energy today?',
  'What did you learn today?',
  'Who made your day better, and how?',
  'What’s on your mind that you haven’t said out loud?',
  'What would make tomorrow a good day?',
  'What are you looking forward to?',
  'What drained you, and what recharged you?',
  'Where did you spend time that mattered?',
  'What’s a small win from today?',
]

function entryFromRecord(r: RecordItem): JournalEntry {
  const d = r.data
  const rating = (v: unknown) => (typeof v === 'number' && v >= 1 && v <= 5 ? v : null)
  return {
    id: r.id,
    day: isISODate(d.day) ? d.day : r.createdAt.slice(0, 10),
    text: r.body,
    mood: rating(d.mood),
    energy: rating(d.energy),
    emotions: Array.isArray(d.emotions) ? d.emotions.map(String) : [],
    prompt: typeof d.prompt === 'string' ? d.prompt : null,
    updatedAt: r.updatedAt,
  }
}

const SELECT = `SELECT * FROM records WHERE collection_id = 'journal' AND deleted_at IS NULL`

export function getEntry(db: Database, p: { day: ISODate }): JournalEntry | null {
  const row = db.selectObjects(`${SELECT} AND json_extract(data, '$.day') = ?`, [p.day])[0]
  return row ? entryFromRecord(recordFromRow(row)) : null
}

export function journalPrompts(db: Database): string[] {
  const raw = db.selectValue(`SELECT value FROM app_meta WHERE key = 'journal.prompts'`)
  try {
    const list = raw ? (JSON.parse(String(raw)) as unknown) : null
    if (Array.isArray(list) && list.length) return list.map(String)
  } catch {
    // Fall back to the defaults.
  }
  return DEFAULT_PROMPTS
}

export function setJournalPrompts(db: Database, p: { prompts: string[] }): string[] {
  const clean = [...new Set(p.prompts.map((x) => x.trim()).filter(Boolean))]
  db.exec({
    sql: `INSERT INTO app_meta (key, value) VALUES ('journal.prompts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    bind: [JSON.stringify(clean.length ? clean : DEFAULT_PROMPTS)],
  })
  return journalPrompts(db)
}

/** The prompt for a day: the same all day, a different one each day, cycling through the list. */
export function promptFor(prompts: string[], day: ISODate): string {
  const n = Math.abs(daysBetween('2000-01-01', day))
  return prompts[n % prompts.length] ?? DEFAULT_PROMPTS[0]!
}

export interface DayEntry {
  day: ISODate
  entry: JournalEntry | null
  prompt: string
}

export function journalDay(db: Database, p: { day: ISODate }): DayEntry {
  const entry = getEntry(db, p)
  return { day: p.day, entry, prompt: entry?.prompt ?? promptFor(journalPrompts(db), p.day) }
}

/**
 * Creates or updates the entry for a day. Fields left out keep their value.
 * An entry with no text, mood, energy or feelings is removed.
 */
export function saveEntry(
  db: Database,
  p: { day: ISODate; text?: string; mood?: number | null; energy?: number | null; emotions?: string[]; prompt?: string | null },
): JournalEntry | null {
  if (!isISODate(p.day)) throw new Error('Invalid date.')
  const existing = getEntry(db, { day: p.day })
  const next = {
    text: p.text ?? existing?.text ?? '',
    mood: p.mood === undefined ? existing?.mood ?? null : p.mood,
    energy: p.energy === undefined ? existing?.energy ?? null : p.energy,
    emotions: p.emotions ?? existing?.emotions ?? [],
    prompt: p.prompt === undefined ? existing?.prompt ?? null : p.prompt,
  }
  const empty = !next.text.trim() && next.mood === null && next.energy === null && next.emotions.length === 0
  if (empty) {
    if (existing) {
      db.exec({ sql: 'UPDATE records SET deleted_at = ? WHERE id = ?', bind: [nowISO(), existing.id] })
      purgeRecord(db, { id: existing.id })
    }
    return null
  }
  const data = {
    day: p.day,
    mood: next.mood,
    energy: next.energy,
    emotions: next.emotions,
    prompt: next.prompt,
  }
  const r = existing
    ? updateRecord(db, { id: existing.id, body: next.text, data })
    : createRecord(db, { collectionId: JOURNAL, title: formatDayWithWeekday(p.day) + ` ${p.day.slice(0, 4)}`, body: next.text, data })
  return entryFromRecord(r)
}

export function listEntries(db: Database, p: { from?: ISODate; to?: ISODate; limit?: number } = {}): JournalEntry[] {
  return db
    .selectObjects(
      `${SELECT} AND json_extract(data, '$.day') BETWEEN ? AND ? ORDER BY json_extract(data, '$.day') DESC LIMIT ?`,
      [p.from ?? '0000-01-01', p.to ?? '9999-12-31', p.limit ?? 1000],
    )
    .map((row) => entryFromRecord(recordFromRow(row)))
}

export interface OnThisDay {
  label: string
  entry: JournalEntry
}

/** Entries from one month, six months and each year before `day`. */
export function onThisDay(db: Database, p: { day: ISODate }): OnThisDay[] {
  const targets: [string, ISODate][] = [
    ['A month ago', addMonths(p.day, -1)],
    ['Six months ago', addMonths(p.day, -6)],
    ...Array.from({ length: 10 }, (_, i) => [i === 0 ? 'A year ago' : `${i + 1} years ago`, addMonths(p.day, -12 * (i + 1))] as [string, ISODate]),
  ]
  const out: OnThisDay[] = []
  for (const [label, day] of targets) {
    const entry = getEntry(db, { day })
    if (entry) out.push({ label, entry })
  }
  return out
}

export interface JournalStats {
  /** Consecutive days with an entry, ending today (or yesterday if today has none yet). */
  streak: number
  entries30: number
  avgMood30: number | null
  mood: { day: ISODate; mood: number }[]
}

export function journalStats(db: Database, p: { today: ISODate; days?: number }): JournalStats {
  const days = p.days ?? 30
  const recent = listEntries(db, { from: addDays(p.today, -(days - 1)), to: p.today })
  const all = new Set(listEntries(db, { from: addDays(p.today, -400), to: p.today }).map((e) => e.day))
  let streak = 0
  let d = all.has(p.today) ? p.today : addDays(p.today, -1)
  while (all.has(d)) {
    streak++
    d = addDays(d, -1)
  }
  const moods = recent.filter((e) => e.mood !== null)
  return {
    streak,
    entries30: recent.length,
    avgMood30: moods.length ? Math.round((moods.reduce((s, e) => s + e.mood!, 0) / moods.length) * 10) / 10 : null,
    mood: moods.map((e) => ({ day: e.day, mood: e.mood! })).sort((a, b) => a.day.localeCompare(b.day)),
  }
}

export interface MoodByHabit {
  habit: string
  doneDays: number
  otherDays: number
  moodDone: number
  moodOther: number
}

/**
 * Average mood on days a habit was done versus scheduled days it wasn't, over the last
 * `days` days. Only habits with at least three days on each side are included.
 */
export function moodByHabit(db: Database, p: { today: ISODate; days?: number }): MoodByHabit[] {
  const from = addDays(p.today, -((p.days ?? 90) - 1))
  const moods = new Map(listEntries(db, { from, to: p.today }).filter((e) => e.mood !== null).map((e) => [e.day, e.mood!]))
  if (moods.size < 6) return []
  const habits = db
    .selectObjects(`SELECT * FROM records WHERE collection_id = 'habits' AND deleted_at IS NULL`)
    .map((r) => habitFromRecord(recordFromRow(r)))
    .filter((h) => !h.archived && h.kind !== 'scale')
  const out: MoodByHabit[] = []
  for (const h of habits) {
    const logs = new Map(
      db
        .selectObjects('SELECT day, value, skipped FROM habit_logs WHERE habit_id = ? AND day >= ?', [h.id, from])
        .map((r) => [String(r.day), { day: String(r.day), value: Number(r.value), skipped: Number(r.skipped) === 1 }]),
    )
    const done: number[] = []
    const other: number[] = []
    for (const [day, mood] of moods) {
      if (day < h.startDate) continue
      const log = logs.get(day)
      if (log?.skipped) continue
      if (h.schedule.type !== 'weekly' && !isScheduled(h, day) && !log) continue
      if (isDone(h, log) && (h.kind !== 'limit' || day < p.today)) done.push(mood)
      else other.push(mood)
    }
    if (done.length >= 3 && other.length >= 3) {
      const avg = (xs: number[]) => Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10
      out.push({ habit: h.name, doneDays: done.length, otherDays: other.length, moodDone: avg(done), moodOther: avg(other) })
    }
  }
  return out.sort((a, b) => Math.abs(b.moodDone - b.moodOther) - Math.abs(a.moodDone - a.moodOther))
}

export function emotionChoices(db: Database): string[] {
  const options = db.selectValue(`SELECT options FROM fields WHERE id = 'journal.emotions'`)
  return ((JSON.parse(String(options ?? '{}')) as { choices?: { label: string }[] }).choices ?? []).map((c) => c.label)
}
