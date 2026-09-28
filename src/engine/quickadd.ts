/**
 * Quick-add parsing: turns "Submit tariff comments Fri 5pm #work p1" into a task with
 * a due date, time, tags and priority. Recognised words are removed from the title.
 */
import { addDays, addMonths, daysInMonth, type ISODate, startOfWeek, weekday } from './dates'
import { firstOccurrence, type Recurrence } from './recurrence'

export interface QuickAddResult {
  title: string
  due?: ISODate
  time?: string
  priority?: 1 | 2 | 3 | 4
  tags: string[]
  recurrence?: Recurrence
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DAY_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)'
const LEAD = '(?:(?:on|by|due|for)\\s+)?'

function weekdayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(w)
}

function monthIndex(word: string): number {
  return MONTHS.indexOf(word.toLowerCase().slice(0, 3))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A calendar date from day/month/(year); without a year, the next such date from today. */
function makeDate(day: number, month0: number, year: number | undefined, today: ISODate): ISODate | null {
  if (month0 < 0 || month0 > 11 || day < 1) return null
  let y = year ?? Number(today.slice(0, 4))
  if (y < 100) y += 2000
  if (day > daysInMonth(y, month0 + 1)) return null
  let date = `${y}-${pad(month0 + 1)}-${pad(day)}`
  if (year === undefined && date < today) {
    y += 1
    if (day > daysInMonth(y, month0 + 1)) return null
    date = `${y}-${pad(month0 + 1)}-${pad(day)}`
  }
  return date
}

export function parseQuickAdd(input: string, today: ISODate): QuickAddResult {
  const text = input
  const used = new Array<boolean>(text.length).fill(false)
  const result: QuickAddResult = { title: '', tags: [] }

  /** Finds the first unused match of `re` and lets `handle` accept it. */
  const take = (re: RegExp, handle: (m: RegExpExecArray) => boolean, all = false): void => {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m: RegExpExecArray | null
    while ((m = global.exec(text))) {
      const start = m.index
      const end = start + m[0].length
      if (m[0].length === 0) {
        global.lastIndex++
        continue
      }
      if (used.slice(start, end).some(Boolean)) continue
      if (handle(m)) {
        for (let i = start; i < end; i++) used[i] = true
        if (!all) return
      }
    }
  }

  // Repeat rules first, so "every monday" isn't read as a one-off date.
  take(new RegExp(`\\b(?:every|each)\\s+(?:(\\d+)\\s+)?(days?|weeks?|months?|weekdays?|${DAY_RE}(?:\\s*(?:,|and|&)\\s*${DAY_RE})*)\\b`, 'i'), (m) => {
    const n = m[1] ? Number(m[1]) : 1
    const unit = m[2]!.toLowerCase()
    if (unit.startsWith('weekday')) result.recurrence = { freq: 'week', interval: 1, weekdays: [0, 1, 2, 3, 4] }
    else if (unit.startsWith('day')) result.recurrence = { freq: 'day', interval: n }
    else if (unit.startsWith('week')) result.recurrence = { freq: 'week', interval: n }
    else if (unit.startsWith('month')) result.recurrence = { freq: 'month', interval: n }
    else {
      const days = [...unit.matchAll(new RegExp(DAY_RE, 'gi'))].map((d) => weekdayIndex(d[0]))
      result.recurrence = { freq: 'week', interval: n, weekdays: [...new Set(days)].sort() }
    }
    return true
  })
  if (!result.recurrence) {
    take(/\b(daily|weekly|monthly)\b/i, (m) => {
      const w = m[1]!.toLowerCase()
      result.recurrence = { freq: w === 'daily' ? 'day' : w === 'weekly' ? 'week' : 'month', interval: 1 }
      return true
    })
  }

  take(/(?:^|\s)p([1-4])(?=\s|$)/i, (m) => {
    result.priority = Number(m[1]) as 1 | 2 | 3 | 4
    return true
  })

  take(/(?:^|\s)#([\p{L}\p{N}_/-]+)/u, (m) => {
    const tag = m[1]!
    if (!result.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) result.tags.push(tag)
    return true
  }, true)

  // Times: 5pm, 5:30 pm, 5.30pm, at 17:30, noon.
  take(/\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, (m) => {
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h < 1 || h > 12 || min > 59) return false
    const pm = m[3]!.toLowerCase() === 'pm'
    if (h === 12) h = pm ? 12 : 0
    else if (pm) h += 12
    result.time = `${pad(h)}:${pad(min)}`
    return true
  })
  if (!result.time) {
    take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => {
      result.time = `${pad(Number(m[1]))}:${m[2]}`
      return true
    })
  }
  if (!result.time) {
    take(/\b(?:at\s+)?noon\b/i, () => {
      result.time = '12:00'
      return true
    })
  }

  // Dates.
  const setDue = (d: ISODate | null): boolean => {
    if (!d || result.due) return false
    result.due = d
    return true
  }
  take(new RegExp(`\\b${LEAD}(today|tonight|tod)\\b`, 'i'), () => setDue(today))
  take(new RegExp(`\\b${LEAD}(tomorrow|tmrw|tmr)\\b`, 'i'), () => setDue(addDays(today, 1)))
  take(/\bnext\s+week\b/i, () => setDue(addDays(startOfWeek(today), 7)))
  take(/\bnext\s+month\b/i, () => setDue(addMonths(today, 1, 1)))
  take(/\bin\s+(\d{1,3})\s+(days?|weeks?|months?)\b/i, (m) => {
    const n = Number(m[1])
    const unit = m[2]!.toLowerCase()
    if (unit.startsWith('day')) return setDue(addDays(today, n))
    if (unit.startsWith('week')) return setDue(addDays(today, 7 * n))
    return setDue(addMonths(today, n))
  })
  take(new RegExp(`\\b${LEAD}(next\\s+)?${DAY_RE}\\b`, 'i'), (m) => {
    const target = weekdayIndex(m[2]!)
    if (target < 0) return false
    if (m[1]) return setDue(addDays(startOfWeek(today), 7 + target))
    const diff = (target - weekday(today) + 7) % 7
    return setDue(addDays(today, diff))
  })
  take(new RegExp(`\\b${LEAD}(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?\\b`, 'i'), (m) =>
    setDue(makeDate(Number(m[1]), monthIndex(m[2]!), m[3] ? Number(m[3]) : undefined, today)),
  )
  take(new RegExp(`\\b${LEAD}${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'), (m) =>
    setDue(makeDate(Number(m[2]), monthIndex(m[1]!), m[3] ? Number(m[3]) : undefined, today)),
  )
  take(new RegExp(`\\b${LEAD}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?\\b`, 'i'), (m) =>
    setDue(makeDate(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : undefined, today)),
  )

  if (result.recurrence && !result.due) result.due = firstOccurrence(result.recurrence, today)
  if (result.time && !result.due) result.due = today

  let title = ''
  for (let i = 0; i < text.length; i++) title += used[i] ? ' ' : text[i]
  result.title = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(?:at|on|by|due|for)$/i, '')
    .trim()
  return result
}
