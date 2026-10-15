/**
 * Reading bank and card statements exported as CSV. Pure functions, no database.
 * Handles quoted fields, preamble lines before the header, separate debit/credit columns,
 * "Dr"/"Cr" suffixes, Indian number grouping and the usual Indian date formats.
 */
import type { ISODate } from './dates'

/** Splits CSV text into rows of cells. Detects comma, semicolon or tab separators. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLines = clean.split('\n').slice(0, 20).join('\n')
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>
  for (const ch of firstLines) if (ch in counts) counts[ch]!++
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0]

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (ch === sep) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c !== ''))
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type DateOrder = 'dmy' | 'mdy' | 'ymd'

/** Reads a date cell. Indian statements are day-first, so 'dmy' is the default. */
export function parseDate(text: string, order: DateOrder = 'dmy'): ISODate | null {
  const t = text.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/i, '')
  let y: number, m: number, d: number
  const named = /^(\d{1,2})[\s\-/.]+([a-z]{3,9})[\s\-/.,]+(\d{2,4})$/i.exec(t)
  const namedFirst = /^([a-z]{3,9})[\s\-/.]+(\d{1,2}),?[\s\-/.]+(\d{2,4})$/i.exec(t)
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t)
  const nums = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t)
  if (named) {
    d = Number(named[1])
    m = MONTHS.indexOf(named[2]!.slice(0, 3).toLowerCase()) + 1
    y = Number(named[3])
  } else if (namedFirst) {
    m = MONTHS.indexOf(namedFirst[1]!.slice(0, 3).toLowerCase()) + 1
    d = Number(namedFirst[2])
    y = Number(namedFirst[3])
  } else if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else if (nums) {
    const a = Number(nums[1])
    const b = Number(nums[2])
    y = Number(nums[3])
    if (order === 'mdy') {
      m = a
      d = b
    } else {
      d = a
      m = b
    }
  } else return null
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Reads an amount cell: "₹1,23,456.78", "-500", "(500.00)", "500 Dr", "INR 1,200 CR".
 * Returns a signed number where negative means money out, or null if empty.
 * Without a sign or Dr/Cr marker the number is returned as positive.
 */
export function parseAmount(text: string): number | null {
  let t = text.trim()
  if (!t || t === '-' || t === '—') return null
  let sign = 1
  if (/\b(dr|debit)\.?$/i.test(t)) {
    sign = -1
    t = t.replace(/\b(dr|debit)\.?$/i, '')
  } else if (/\b(cr|credit)\.?$/i.test(t)) {
    t = t.replace(/\b(cr|credit)\.?$/i, '')
  }
  if (/^\(.*\)$/.test(t.trim())) {
    sign = -sign
    t = t.trim().slice(1, -1)
  }
  t = t.replace(/inr|rs\.?|₹|\s/gi, '')
  if (t.startsWith('-')) {
    sign = -sign
    t = t.slice(1)
  } else if (t.startsWith('+')) t = t.slice(1)
  t = t.replace(/,/g, '')
  if (!/^\d*\.?\d+$/.test(t)) return null
  const n = Number(t) * sign
  return Number.isFinite(n) ? n : null
}

export interface ColumnMapping {
  headerRow: number
  date: number
  description: number
  /** Single signed amount column, or -1. */
  amount: number
  /** Separate money-out / money-in columns, or -1. */
  debit: number
  credit: number
  /** For a single amount column: does a plain positive number mean money out? (Card statements: yes.) */
  positiveIsSpend: boolean
  dateOrder: DateOrder
}

const has = (cell: string, ...words: string[]) => words.some((w) => cell.includes(w))

/** Finds the header row and guesses which column is which. */
export function guessMapping(rows: string[][]): ColumnMapping {
  let headerRow = 0
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i]!.map((c) => c.toLowerCase())
    if (cells.some((c) => has(c, 'date')) && cells.some((c) => has(c, 'amount', 'debit', 'withdrawal', 'credit', 'deposit', 'dr', 'cr'))) {
      headerRow = i
      break
    }
  }
  const header = (rows[headerRow] ?? []).map((c) => c.toLowerCase())
  const find = (test: (c: string) => boolean, avoid: number[] = []) =>
    header.findIndex((c, i) => !avoid.includes(i) && test(c))
  const date = Math.max(0, find((c) => has(c, 'txn date', 'transaction date', 'tran date')) >= 0
    ? find((c) => has(c, 'txn date', 'transaction date', 'tran date'))
    : find((c) => has(c, 'date') && !has(c, 'value date')) >= 0
      ? find((c) => has(c, 'date') && !has(c, 'value date'))
      : find((c) => has(c, 'date')))
  const description = find((c) => has(c, 'narration', 'description', 'particulars', 'details', 'remarks', 'merchant', 'transaction'), [date])
  const debit = find((c) => has(c, 'withdrawal', 'debit', 'paid out', 'money out') || c === 'dr' || c === 'dr.' || c.startsWith('dr ') || has(c, '(dr)'))
  const credit = find((c) => has(c, 'deposit', 'credit', 'paid in', 'money in') || c === 'cr' || c === 'cr.' || c.startsWith('cr ') || has(c, '(cr)'))
  const amount = debit >= 0 && credit >= 0 ? -1 : find((c) => has(c, 'amount', 'amt', 'value') && !has(c, 'balance'))
  // Day-first unless a value only makes sense month-first.
  let dateOrder: DateOrder = 'dmy'
  for (const r of rows.slice(headerRow + 1, headerRow + 40)) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/.exec((r[date] ?? '').trim())
    if (m && Number(m[2]) > 12) {
      dateOrder = 'mdy'
      break
    }
  }
  return {
    headerRow,
    date,
    description: description >= 0 ? description : Math.min(1, header.length - 1),
    amount,
    debit: amount >= 0 ? -1 : debit,
    credit: amount >= 0 ? -1 : credit,
    positiveIsSpend: true,
    dateOrder,
  }
}

export interface StatementLine {
  row: number
  date: ISODate
  description: string
  /** Positive amount in INR. */
  amount: number
  type: 'expense' | 'income'
}

export interface ReadResult {
  lines: StatementLine[]
  skipped: { row: number; reason: string }[]
}

/** Turns rows into transactions using a column mapping. */
export function readStatement(rows: string[][], map: ColumnMapping): ReadResult {
  const lines: StatementLine[] = []
  const skipped: ReadResult['skipped'] = []
  rows.forEach((r, i) => {
    if (i <= map.headerRow) return
    const rowNo = i + 1
    const date = parseDate(r[map.date] ?? '', map.dateOrder)
    if (!date) {
      // Footer lines ("Opening balance", totals) have no date; skip quietly unless they look like data.
      if (/\d/.test(r[map.date] ?? '')) skipped.push({ row: rowNo, reason: `Couldn’t read the date “${r[map.date]}”` })
      return
    }
    let signed: number | null = null
    if (map.amount >= 0) {
      const v = parseAmount(r[map.amount] ?? '')
      if (v !== null) {
        const marked = /\b(dr|cr|debit|credit)\.?$/i.test((r[map.amount] ?? '').trim())
        signed = marked || v < 0 ? v : map.positiveIsSpend ? -v : v
      }
    } else {
      const out = map.debit >= 0 ? parseAmount(r[map.debit] ?? '') : null
      const inn = map.credit >= 0 ? parseAmount(r[map.credit] ?? '') : null
      if (out) signed = -Math.abs(out)
      else if (inn) signed = Math.abs(inn)
    }
    if (signed === null || signed === 0) {
      skipped.push({ row: rowNo, reason: 'No amount' })
      return
    }
    lines.push({
      row: rowNo,
      date,
      description: cleanDescription(r[map.description] ?? ''),
      amount: Math.round(Math.abs(signed) * 100) / 100,
      type: signed < 0 ? 'expense' : 'income',
    })
  })
  return { lines, skipped }
}

/**
 * Shortens bank narrations to the merchant where possible:
 * "UPI/DR/429812345678/SWIGGY/YESB/swiggy@ybl/Payment" → "Swiggy".
 */
export function cleanDescription(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const upi = /^(?:upi|imps|neft|rtgs)[-/ ]/i.test(t)
  if (upi) {
    const parts = t.split(/[/-]/).map((p) => p.trim()).filter(Boolean)
    const name = parts.find(
      (p, i) =>
        i > 0 &&
        /[a-z]{3,}/i.test(p) &&
        !/^(upi|dr|cr|imps|neft|rtgs|p2m|p2a|payment|pay|paid|collect|sent|received|ref|yesb|hdfc|icic|sbin|utib|kkbk|axis|ybl|okaxis|oksbi|okhdfcbank|okicici|paytm|ibl|axl|apl)$/i.test(p) &&
        !p.includes('@') &&
        !/^\d+$/.test(p),
    )
    if (name) return titleCase(name)
  }
  const pos = /^(?:pos|ecom|vps|vin)[\s/:-]+(?:[\dx*]{4,}[\s/:-]+)?(.+?)(?:\s+(?:mumbai|delhi|bangalore|bengaluru|chennai|pune|hyderabad|kolkata|gurgaon|gurugram|noida|in|ind))*$/i.exec(t)
  if (pos) return titleCase(pos[1]!.replace(/\s+\d{4,}.*/, ''))
  return t.length > 80 ? `${t.slice(0, 77)}…` : t
}

function titleCase(s: string): string {
  const lower = s.toLowerCase()
  return lower.replace(/(^|[\s&])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}

/** Normalises a description so the same merchant matches across months. */
export function merchantKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .join(' ')
}

const KEYWORDS: [RegExp, string][] = [
  [/swiggy|zomato|restaurant|cafe|coffee|starbucks|dominos|pizza|mcdonald|kfc|burger|dining|eatery|haldiram|chaayos/i, 'Food & dining'],
  [/bigbasket|blinkit|zepto|instamart|dmart|grocer|jiomart|more retail|reliance fresh|nature.?s basket|milkbasket|country delight/i, 'Groceries'],
  [/uber|ola|rapido|metro|irctc|redbus|parking|fastag|toll|namma yatri|blusmart/i, 'Transport'],
  [/petrol|fuel|hpcl|bpcl|indian oil|iocl|shell|hp pay/i, 'Fuel'],
  [/electric|bescom|tata power|adani elec|msedcl|bses|torrent power|water|gas|airtel|jio|vodafone|vi |bsnl|broadband|act fibernet|recharge|dth|tata play/i, 'Bills & utilities'],
  [/\brent\b|nobroker|housing\.com|landlord|society maint/i, 'Rent'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|croma|reliance digital|decathlon|ikea|tata cliq|shoppers stop|lifestyle/i, 'Shopping'],
  [/makemytrip|goibibo|cleartrip|ixigo|indigo|air india|vistara|akasa|spicejet|airbnb|booking\.com|oyo|agoda|hotel|taj|marriott|hyatt|airport/i, 'Travel'],
  [/apollo|pharmeasy|1mg|netmeds|medplus|hospital|clinic|diagnostic|lab|pharma|chemist|practo|cult\.?fit|gym/i, 'Health'],
  [/bookmyshow|pvr|inox|cinema|steam|playstation|xbox/i, 'Entertainment'],
  [/netflix|spotify|hotstar|prime video|youtube|apple\.com|icloud|google|microsoft|adobe|zee5|sonyliv|jiocinema|notion|chatgpt|openai|anthropic|claude/i, 'Subscriptions'],
  [/udemy|coursera|school|college|tuition|books|kindle|byju|unacademy/i, 'Education'],
  [/salon|spa|urban company|barber/i, 'Personal care'],
  [/charges|fee|gst|penalty|annual fee|interest charged|late payment|surcharge/i, 'Fees & charges'],
]

/** A category for a statement line from keywords, or null. */
export function guessCategory(description: string, type: 'expense' | 'income'): string | null {
  if (type === 'income') {
    if (/salary|sal cr|payroll/i.test(description)) return 'Salary'
    if (/refund|reversal|cashback/i.test(description)) return 'Refund'
    if (/interest|int\.? pd|int cr/i.test(description)) return 'Interest'
    return 'Other income'
  }
  for (const [re, cat] of KEYWORDS) if (re.test(description)) return cat
  return null
}

/** Quotes a value for CSV output. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
