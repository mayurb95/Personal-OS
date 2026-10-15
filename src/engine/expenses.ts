/**
 * Money: expenses and income (records in the built-in 'expenses' collection, amounts in INR),
 * monthly budgets, recurring expenses, statement import and CSV export.
 */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { newId, nowISO } from './clock'
import { ensureChoice, requireCollection, updateCollection, updateField } from './collections'
import { csvCell, guessCategory, merchantKey, type StatementLine } from './csv'
import { addDays, addMonths, daysInMonth, type ISODate, isISODate } from './dates'
import { createRecord, recordFromRow, requireRecord, updateRecord } from './records'
import type { RecordData, RecordItem } from './types'

export const EXPENSES = 'expenses'

export type MoneyType = 'expense' | 'income'

export interface Expense {
  id: string
  title: string
  note: string
  /** Amount in INR. */
  amount: number
  date: ISODate
  category: string
  method: string
  type: MoneyType
  /** Set when spent in another currency. */
  currency: string | null
  originalAmount: number | null
  rate: number | null
  recurringId: string | null
}

export function expenseFromRecord(r: RecordItem): Expense {
  const d = r.data
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    id: r.id,
    title: r.title,
    note: r.body,
    amount: n(d.amount) ?? 0,
    date: isISODate(d.date) ? d.date : r.createdAt.slice(0, 10),
    category: typeof d.category === 'string' ? d.category : '',
    method: typeof d.method === 'string' ? d.method : '',
    type: d.type === 'income' ? 'income' : 'expense',
    currency: typeof d.currency === 'string' && d.currency !== 'INR' ? d.currency : null,
    originalAmount: n(d.original_amount),
    rate: n(d.rate),
    recurringId: typeof d.recurring_id === 'string' ? d.recurring_id : null,
  }
}

export interface ExpenseInput {
  /** Amount in `currency` (INR when not given). */
  amount: number
  currency?: string | null
  /** INR per unit of `currency`; required for foreign currencies. */
  rate?: number | null
  date: ISODate
  title?: string
  note?: string
  category?: string
  method?: string
  type?: MoneyType
}

const round2 = (n: number) => Math.round(n * 100) / 100

function toData(db: Database, p: ExpenseInput): RecordData {
  if (!Number.isFinite(p.amount) || p.amount <= 0) throw new Error('Enter an amount above zero.')
  if (!isISODate(p.date)) throw new Error('Choose a date.')
  const currency = (p.currency ?? 'INR').toUpperCase()
  const data: RecordData = {
    date: p.date,
    type: p.type === 'income' ? 'income' : 'expense',
    category: p.category?.trim() ? ensureChoice(db, 'expenses.category', p.category) : null,
    method: p.method?.trim() ? ensureChoice(db, 'expenses.method', p.method) : null,
  }
  if (currency === 'INR') {
    data.amount = round2(p.amount)
    data.currency = null
    data.original_amount = null
    data.rate = null
  } else {
    const rate = Number(p.rate)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Enter the exchange rate: how many ₹ for 1 ${currency}.`)
    data.amount = round2(p.amount * rate)
    data.currency = currency
    data.original_amount = round2(p.amount)
    data.rate = rate
    db.exec({
      sql: `INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      bind: [`fx.${currency}`, String(rate)],
    })
  }
  return data
}

export interface BudgetAlert {
  category: string
  spent: number
  budget: number
  /** 80 or 100. */
  level: number
}

function monthOf(date: ISODate): string {
  return date.slice(0, 7)
}

function monthRange(month: string): [ISODate, ISODate] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return [`${month}-01`, `${month}-${String(daysInMonth(y, m)).padStart(2, '0')}`]
}

function spentIn(db: Database, from: ISODate, to: ISODate, category?: string): number {
  return Number(
    db.selectValue(
      `SELECT coalesce(sum(json_extract(data, '$.amount')), 0) FROM records
       WHERE collection_id = 'expenses' AND deleted_at IS NULL AND json_extract(data, '$.type') = 'expense'
         AND json_extract(data, '$.date') BETWEEN ? AND ? ${category ? `AND json_extract(data, '$.category') = ?` : ''}`,
      category ? [from, to, category] : [from, to],
    ) ?? 0,
  )
}

/** Checks whether adding `amount` pushed a category (or the total) past 80% or 100% of its budget. */
function budgetAlert(db: Database, e: Expense, previousAmount = 0): BudgetAlert | null {
  if (e.type !== 'expense') return null
  const budgets = getBudgets(db)
  const [from, to] = monthRange(monthOf(e.date))
  const check = (key: string, budget: number | undefined, category?: string): BudgetAlert | null => {
    if (!budget) return null
    const after = spentIn(db, from, to, category)
    const before = after - e.amount + previousAmount
    for (const level of [100, 80]) {
      const line = (budget * level) / 100
      if (after >= line && before < line) return { category: key, spent: after, budget, level }
    }
    return null
  }
  return (e.category ? check(e.category, budgets[e.category], e.category) : null) ?? check('Total', budgets.__total)
}

export function addExpense(db: Database, p: ExpenseInput): { expense: Expense; alert: BudgetAlert | null } {
  return db.transaction((tx) => {
    const r = createRecord(tx, {
      collectionId: EXPENSES,
      title: p.title?.trim() || p.category?.trim() || (p.type === 'income' ? 'Income' : 'Expense'),
      body: p.note ?? '',
      data: toData(tx, p),
    })
    const expense = expenseFromRecord(r)
    return { expense, alert: budgetAlert(tx, expense) }
  })
}

export function updateExpense(db: Database, p: { id: string } & ExpenseInput): { expense: Expense; alert: BudgetAlert | null } {
  return db.transaction((tx) => {
    const before = getExpense(tx, { id: p.id })
    const r = updateRecord(tx, {
      id: p.id,
      title: p.title?.trim() || p.category?.trim() || before.title,
      body: p.note,
      data: toData(tx, p),
    })
    const expense = expenseFromRecord(r)
    const sameMonth = monthOf(before.date) === monthOf(expense.date) && before.category === expense.category
    return { expense, alert: budgetAlert(tx, expense, sameMonth && before.type === 'expense' ? before.amount : 0) }
  })
}

export function getExpense(db: Database, p: { id: string }): Expense {
  const r = requireRecord(db, p.id)
  if (r.collectionId !== EXPENSES) throw new Error('That item isn’t an expense.')
  return expenseFromRecord(r)
}

export function listExpenses(
  db: Database,
  p: { from: ISODate; to: ISODate; category?: string; text?: string; limit?: number },
): Expense[] {
  const bind: (string | number)[] = [p.from, p.to]
  let where = `collection_id = 'expenses' AND deleted_at IS NULL AND json_extract(data, '$.date') BETWEEN ? AND ?`
  if (p.category) {
    where += ` AND json_extract(data, '$.category') = ?`
    bind.push(p.category)
  }
  if (p.text?.trim()) {
    where += ` AND (instr(lower(title), ?) > 0 OR instr(lower(body), ?) > 0)`
    bind.push(p.text.trim().toLowerCase(), p.text.trim().toLowerCase())
  }
  bind.push(p.limit ?? 2000)
  return db
    .selectObjects(
      `SELECT * FROM records WHERE ${where} ORDER BY json_extract(data, '$.date') DESC, created_at DESC LIMIT ?`,
      bind,
    )
    .map((row) => expenseFromRecord(recordFromRow(row)))
}

// ── Settings: categories, payment methods, budgets ──────────────────────────

export type Budgets = Record<string, number>

export function getBudgets(db: Database): Budgets {
  const c = requireCollection(db, EXPENSES)
  const b = c.settings.budgets ?? {}
  return Object.fromEntries(Object.entries(b).filter(([, v]) => typeof v === 'number' && v > 0))
}

/** Sets a monthly budget for a category, or for everything with category '__total'. null removes it. */
export function setBudget(db: Database, p: { category: string; amount: number | null }): Budgets {
  const budgets = { ...getBudgets(db) }
  if (p.amount === null || !Number.isFinite(p.amount) || p.amount <= 0) delete budgets[p.category]
  else budgets[p.category] = Math.round(p.amount)
  updateCollection(db, { id: EXPENSES, settings: { budgets } })
  return budgets
}

export interface MoneySettings {
  categories: string[]
  methods: string[]
  budgets: Budgets
  rates: Record<string, number>
}

export function moneySettings(db: Database): MoneySettings {
  const c = requireCollection(db, EXPENSES)
  const choices = (key: string) => c.fields.find((f) => f.key === key)?.options.choices?.map((x) => x.label) ?? []
  const rates = Object.fromEntries(
    db
      .selectObjects(`SELECT key, value FROM app_meta WHERE key LIKE 'fx.%'`)
      .map((r) => [String(r.key).slice(3), Number(r.value)]),
  )
  return { categories: choices('category'), methods: choices('method'), budgets: getBudgets(db), rates }
}

/** Replaces the list of categories or payment methods. Existing entries keep their labels. */
export function setMoneyChoices(db: Database, p: { kind: 'category' | 'method'; labels: string[] }): void {
  const field = requireCollection(db, EXPENSES).fields.find((f) => f.key === p.kind)!
  const existing = new Map((field.options.choices ?? []).map((c) => [c.label.toLowerCase(), c.id]))
  updateField(db, {
    id: field.id,
    options: { choices: p.labels.map((label) => ({ id: existing.get(label.trim().toLowerCase()) ?? '', label })) },
  })
}

// ── Summary for a month ─────────────────────────────────────────────────────

export interface MoneySummary {
  month: string
  spent: number
  income: number
  budgetTotal: number | null
  byCategory: { category: string; spent: number; budget: number | null; count: number }[]
  daily: { day: ISODate; spent: number }[]
  months: { month: string; spent: number; income: number }[]
  topMerchants: { title: string; spent: number; count: number }[]
  byMethod: { method: string; spent: number }[]
}

export function moneySummary(db: Database, p: { month: string }): MoneySummary {
  const [from, to] = monthRange(p.month)
  const list = listExpenses(db, { from, to })
  const budgets = getBudgets(db)
  const spending = list.filter((e) => e.type === 'expense')
  const cats = new Map<string, { spent: number; count: number }>()
  for (const e of spending) {
    const k = e.category || 'Uncategorised'
    const c = cats.get(k) ?? { spent: 0, count: 0 }
    cats.set(k, { spent: c.spent + e.amount, count: c.count + 1 })
  }
  for (const k of Object.keys(budgets)) if (k !== '__total' && !cats.has(k)) cats.set(k, { spent: 0, count: 0 })
  const days = Number(to.slice(8))
  const daily = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i)
    return { day, spent: round2(spending.filter((e) => e.date === day).reduce((s, e) => s + e.amount, 0)) }
  })
  const months = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(from, i - 5).slice(0, 7)
    const [mf, mt] = monthRange(m)
    const income = Number(
      db.selectValue(
        `SELECT coalesce(sum(json_extract(data, '$.amount')), 0) FROM records WHERE collection_id = 'expenses'
         AND deleted_at IS NULL AND json_extract(data, '$.type') = 'income' AND json_extract(data, '$.date') BETWEEN ? AND ?`,
        [mf, mt],
      ) ?? 0,
    )
    return { month: m, spent: round2(spentIn(db, mf, mt)), income: round2(income) }
  })
  const merchants = new Map<string, { title: string; spent: number; count: number }>()
  for (const e of spending) {
    const k = merchantKey(e.title) || e.title.toLowerCase()
    const m = merchants.get(k) ?? { title: e.title, spent: 0, count: 0 }
    merchants.set(k, { title: m.title, spent: m.spent + e.amount, count: m.count + 1 })
  }
  const methods = new Map<string, number>()
  for (const e of spending) methods.set(e.method || 'Not set', (methods.get(e.method || 'Not set') ?? 0) + e.amount)
  return {
    month: p.month,
    spent: round2(spending.reduce((s, e) => s + e.amount, 0)),
    income: round2(list.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)),
    budgetTotal: budgets.__total ?? null,
    byCategory: [...cats.entries()]
      .map(([category, v]) => ({ category, spent: round2(v.spent), count: v.count, budget: budgets[category] ?? null }))
      .sort((a, b) => b.spent - a.spent || (b.budget ?? 0) - (a.budget ?? 0)),
    daily,
    months,
    topMerchants: [...merchants.values()]
      .map((m) => ({ ...m, spent: round2(m.spent) }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5),
    byMethod: [...methods.entries()].map(([method, spent]) => ({ method, spent: round2(spent) })).sort((a, b) => b.spent - a.spent),
  }
}

/** Spent today and this month, for the Today screen. */
export function spendingSnapshot(db: Database, p: { today: ISODate }): { today: number; month: number; budget: number | null } {
  const [from] = monthRange(monthOf(p.today))
  return {
    today: round2(spentIn(db, p.today, p.today)),
    month: round2(spentIn(db, from, p.today)),
    budget: getBudgets(db).__total ?? null,
  }
}

// ── Recurring expenses ──────────────────────────────────────────────────────

export interface Recurring {
  id: string
  title: string
  amount: number
  category: string
  method: string
  freq: 'week' | 'month' | 'year'
  interval: number
  nextDate: ISODate
  active: boolean
}

function recurringFromRow(r: Record<string, unknown>): Recurring {
  return {
    id: String(r.id),
    title: String(r.title),
    amount: Number(r.amount),
    category: String(r.category ?? ''),
    method: String(r.method ?? ''),
    freq: r.freq === 'week' || r.freq === 'year' ? r.freq : 'month',
    interval: Number(r.interval ?? 1),
    nextDate: String(r.next_date),
    active: Number(r.active) === 1,
  }
}

export function listRecurring(db: Database): Recurring[] {
  return db
    .selectObjects('SELECT * FROM recurring_expenses ORDER BY active DESC, next_date, title COLLATE NOCASE')
    .map(recurringFromRow)
}

function advance(r: Pick<Recurring, 'freq' | 'interval'>, date: ISODate, dayOfMonth: number | null): ISODate {
  if (r.freq === 'week') return addDays(date, 7 * r.interval)
  return addMonths(date, r.freq === 'year' ? 12 * r.interval : r.interval, dayOfMonth ?? undefined)
}

export function saveRecurring(
  db: Database,
  p: { id?: string; title: string; amount: number; category?: string; method?: string; freq: Recurring['freq']; interval?: number; nextDate: ISODate; active?: boolean },
): Recurring {
  const title = p.title.trim()
  if (!title) throw new Error('Name the recurring expense, e.g. Rent or Netflix.')
  if (!Number.isFinite(p.amount) || p.amount <= 0) throw new Error('Enter an amount above zero.')
  if (!isISODate(p.nextDate)) throw new Error('Choose the next date it’s due.')
  const category = p.category?.trim() ? ensureChoice(db, 'expenses.category', p.category) : ''
  const method = p.method?.trim() ? ensureChoice(db, 'expenses.method', p.method) : ''
  const interval = Math.max(1, Math.round(p.interval ?? 1))
  const dom = Number(p.nextDate.slice(8))
  if (p.id) {
    db.exec({
      sql: `UPDATE recurring_expenses SET title = ?, amount = ?, category = ?, method = ?, freq = ?, interval = ?,
            next_date = ?, day_of_month = ?, active = ? WHERE id = ?`,
      bind: [title, round2(p.amount), category, method, p.freq, interval, p.nextDate, dom, p.active === false ? 0 : 1, p.id],
    })
    return recurringFromRow(db.selectObjects('SELECT * FROM recurring_expenses WHERE id = ?', [p.id])[0]!)
  }
  const id = newId()
  db.exec({
    sql: `INSERT INTO recurring_expenses (id, title, amount, category, method, freq, interval, next_date, day_of_month, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    bind: [id, title, round2(p.amount), category, method, p.freq, interval, p.nextDate, dom, nowISO()],
  })
  return recurringFromRow(db.selectObjects('SELECT * FROM recurring_expenses WHERE id = ?', [id])[0]!)
}

export function deleteRecurring(db: Database, p: { id: string }): void {
  db.exec({ sql: 'DELETE FROM recurring_expenses WHERE id = ?', bind: [p.id] })
}

/** Adds an expense for every recurring item that has come due, and moves each to its next date. */
export function postDueRecurring(db: Database, p: { today: ISODate }): number {
  let posted = 0
  db.transaction((tx) => {
    const due = tx.selectObjects('SELECT * FROM recurring_expenses WHERE active = 1 AND next_date <= ?', [p.today])
    for (const row of due) {
      const r = recurringFromRow(row)
      const dom = row.day_of_month == null ? null : Number(row.day_of_month)
      let date = r.nextDate
      for (let guard = 0; date <= p.today && guard < 60; guard++) {
        createRecord(tx, {
          collectionId: EXPENSES,
          title: r.title,
          data: {
            amount: r.amount,
            date,
            category: r.category || null,
            method: r.method || null,
            type: 'expense',
            recurring_id: r.id,
          },
        })
        posted++
        date = advance(r, date, dom)
      }
      tx.exec({ sql: 'UPDATE recurring_expenses SET next_date = ? WHERE id = ?', bind: [date, r.id] })
    }
  })
  return posted
}

// ── Import and export ───────────────────────────────────────────────────────

export interface ImportPreviewLine extends StatementLine {
  category: string | null
  duplicate: boolean
}

function importKey(l: Pick<StatementLine, 'date' | 'amount' | 'description' | 'type'>): string {
  return `${l.date}|${l.type}|${l.amount.toFixed(2)}|${merchantKey(l.description)}`
}

/**
 * Prepares statement lines for import: guesses a category from earlier expenses with the
 * same merchant (then from keywords), and flags lines that look already imported or entered.
 */
export function previewImport(db: Database, p: { lines: StatementLine[] }): ImportPreviewLine[] {
  const history = new Map<string, string>()
  for (const r of db.selectObjects(
    `SELECT title, json_extract(data, '$.category') AS category FROM records
     WHERE collection_id = 'expenses' AND deleted_at IS NULL AND json_extract(data, '$.category') IS NOT NULL
     ORDER BY updated_at`,
  )) {
    const k = merchantKey(String(r.title))
    if (k) history.set(k, String(r.category))
  }
  const dates = p.lines.map((l) => l.date).sort()
  const existing = new Set<string>()
  if (dates.length) {
    for (const r of db.selectObjects(
      `SELECT title, data FROM records WHERE collection_id = 'expenses' AND deleted_at IS NULL
       AND json_extract(data, '$.date') BETWEEN ? AND ?`,
      [dates[0]!, dates.at(-1)!],
    )) {
      const d = JSON.parse(String(r.data)) as Record<string, unknown>
      if (typeof d.import_key === 'string') existing.add(d.import_key)
      // A manual entry on the same day for the same amount counts as the same expense.
      existing.add(`${d.date}|${d.type === 'income' ? 'income' : 'expense'}|${Number(d.amount).toFixed(2)}|*`)
    }
  }
  return p.lines.map((l) => ({
    ...l,
    category: history.get(merchantKey(l.description)) ?? guessCategory(l.description, l.type),
    duplicate:
      existing.has(importKey(l)) || existing.has(`${l.date}|${l.type}|${l.amount.toFixed(2)}|*`),
  }))
}

export function importExpenses(
  db: Database,
  p: { lines: (StatementLine & { category: string | null })[]; method?: string },
): number {
  let n = 0
  db.transaction((tx) => {
    const method = p.method?.trim() ? ensureChoice(tx, 'expenses.method', p.method) : null
    for (const l of p.lines) {
      createRecord(tx, {
        collectionId: EXPENSES,
        title: l.description || (l.type === 'income' ? 'Income' : 'Expense'),
        data: {
          amount: round2(l.amount),
          date: l.date,
          type: l.type,
          category: l.category ? ensureChoice(tx, 'expenses.category', l.category) : null,
          method,
          import_key: importKey(l),
        },
      })
      n++
    }
  })
  return n
}

export function exportExpensesCSV(db: Database, p: { from: ISODate; to: ISODate }): string {
  const header = ['Date', 'Description', 'Type', 'Category', 'Paid with', 'Amount (INR)', 'Currency', 'Amount in currency', 'Rate', 'Note']
  const rows = listExpenses(db, { from: p.from, to: p.to, limit: 100_000 })
    .reverse()
    .map((e) =>
      [e.date, e.title, e.type, e.category, e.method, e.amount, e.currency ?? 'INR', e.originalAmount ?? '', e.rate ?? '', e.note]
        .map(csvCell)
        .join(','),
    )
  return [header.join(','), ...rows].join('\n') + '\n'
}
