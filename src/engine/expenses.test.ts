import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import { guessMapping, parseCSV, readStatement } from './csv'
import {
  addExpense,
  exportExpensesCSV,
  importExpenses,
  listExpenses,
  listRecurring,
  moneySettings,
  moneySummary,
  postDueRecurring,
  previewImport,
  saveRecurring,
  setBudget,
  setMoneyChoices,
  spendingSnapshot,
  updateExpense,
} from './expenses'
import { search } from './records'

let db: Database
beforeEach(async () => {
  db = await freshDb()
})

describe('expenses', () => {
  it('ships Indian categories and payment methods', () => {
    const s = moneySettings(db)
    expect(s.categories).toContain('Food & dining')
    expect(s.methods).toEqual(['UPI', 'SBI Aurum card', 'HDFC Diners card', 'Debit card', 'Cash', 'Bank transfer'])
  })

  it('adds INR and foreign-currency expenses and remembers rates', () => {
    const a = addExpense(db, { amount: 450, date: '2026-10-05', title: 'Swiggy', category: 'Food & dining', method: 'UPI' }).expense
    expect(a).toMatchObject({ amount: 450, currency: null, type: 'expense', category: 'Food & dining' })
    const b = addExpense(db, { amount: 12.5, currency: 'usd', rate: 84, date: '2026-10-06', category: 'Subscriptions' }).expense
    expect(b).toMatchObject({ amount: 1050, currency: 'USD', originalAmount: 12.5, rate: 84, title: 'Subscriptions' })
    expect(moneySettings(db).rates).toEqual({ USD: 84 })
    expect(() => addExpense(db, { amount: 10, currency: 'EUR', date: '2026-10-06' })).toThrow(/exchange rate/)
    expect(() => addExpense(db, { amount: 0, date: '2026-10-06' })).toThrow(/above zero/)
    expect(search(db, { query: 'swig' })[0]!.collectionKind).toBe('expenses')
  })

  it('warns when spending crosses 80% and 100% of a budget', () => {
    setBudget(db, { category: 'Food & dining', amount: 1000 })
    expect(addExpense(db, { amount: 700, date: '2026-10-05', category: 'Food & dining' }).alert).toBeNull()
    expect(addExpense(db, { amount: 150, date: '2026-10-06', category: 'Food & dining' }).alert).toMatchObject({ level: 80, spent: 850 })
    expect(addExpense(db, { amount: 100, date: '2026-10-07', category: 'Food & dining' }).alert).toBeNull()
    const over = addExpense(db, { amount: 100, date: '2026-10-08', category: 'Food & dining' })
    expect(over.alert).toMatchObject({ level: 100, spent: 1050 })
    // Editing an amount counts only the difference.
    expect(updateExpense(db, { id: over.expense.id, amount: 120, date: '2026-10-08', category: 'Food & dining' }).alert).toBeNull()
    // Next month starts fresh.
    expect(addExpense(db, { amount: 900, date: '2026-11-01', category: 'Food & dining' }).alert).toMatchObject({ level: 80 })
  })

  it('summarises a month by category, day, merchant and method, with six months of totals', () => {
    setBudget(db, { category: '__total', amount: 50000 })
    setBudget(db, { category: 'Travel', amount: 5000 })
    addExpense(db, { amount: 450, date: '2026-10-05', title: 'Swiggy', category: 'Food & dining', method: 'UPI' })
    addExpense(db, { amount: 300, date: '2026-10-05', title: 'Swiggy', category: 'Food & dining', method: 'UPI' })
    addExpense(db, { amount: 2000, date: '2026-10-07', title: 'Uber', category: 'Transport', method: 'HDFC Diners card' })
    addExpense(db, { amount: 150000, date: '2026-10-01', title: 'Salary', category: 'Salary', type: 'income' })
    addExpense(db, { amount: 999, date: '2026-09-15', title: 'Netflix', category: 'Subscriptions' })
    const s = moneySummary(db, { month: '2026-10' })
    expect(s.spent).toBe(2750)
    expect(s.income).toBe(150000)
    expect(s.budgetTotal).toBe(50000)
    expect(s.byCategory).toEqual([
      { category: 'Transport', spent: 2000, count: 1, budget: null },
      { category: 'Food & dining', spent: 750, count: 2, budget: null },
      { category: 'Travel', spent: 0, count: 0, budget: 5000 },
    ])
    expect(s.daily).toHaveLength(31)
    expect(s.daily[4]).toEqual({ day: '2026-10-05', spent: 750 })
    expect(s.months.map((m) => [m.month, m.spent])).toEqual([
      ['2026-05', 0], ['2026-06', 0], ['2026-07', 0], ['2026-08', 0], ['2026-09', 999], ['2026-10', 2750],
    ])
    expect(s.topMerchants[1]).toEqual({ title: 'Swiggy', spent: 750, count: 2 })
    expect(s.byMethod[0]).toEqual({ method: 'HDFC Diners card', spent: 2000 })
    expect(spendingSnapshot(db, { today: '2026-10-07' })).toEqual({ today: 2000, month: 2750, budget: 50000 })
    expect(listExpenses(db, { from: '2026-10-01', to: '2026-10-31', category: 'Food & dining' })).toHaveLength(2)
  })

  it('edits categories and methods without losing existing labels', () => {
    setMoneyChoices(db, { kind: 'method', labels: ['UPI', 'Axis Burgundy card', 'Cash'] })
    expect(moneySettings(db).methods).toEqual(['UPI', 'Axis Burgundy card', 'Cash'])
  })
})

describe('recurring', () => {
  it('posts due items, catching up missed months, and moves the next date', () => {
    saveRecurring(db, { title: 'Rent', amount: 25000, category: 'Rent', method: 'Bank transfer', freq: 'month', nextDate: '2026-08-31' })
    saveRecurring(db, { title: 'Netflix', amount: 649, category: 'Subscriptions', freq: 'month', nextDate: '2026-11-02' })
    expect(postDueRecurring(db, { today: '2026-10-15' })).toBe(2)
    const rent = listExpenses(db, { from: '2026-01-01', to: '2026-12-31' }).filter((e) => e.title === 'Rent')
    expect(rent.map((e) => e.date)).toEqual(['2026-09-30', '2026-08-31'])
    expect(listRecurring(db).find((r) => r.title === 'Rent')!.nextDate).toBe('2026-10-31')
    expect(postDueRecurring(db, { today: '2026-10-15' })).toBe(0)
  })
})

describe('import and export', () => {
  it('previews with categories from history and flags duplicates, then imports', () => {
    addExpense(db, { amount: 300, date: '2026-09-01', title: 'Chai Point', category: 'Food & dining' })
    addExpense(db, { amount: 649, date: '2026-10-05', title: 'Netflix', category: 'Subscriptions' })
    const rows = parseCSV(`Date,Description,Amount
04/10/2026,CHAI POINT KORAMANGALA,120
05/10/2026,NETFLIX.COM,649
06/10/2026,Mystery store,999
`)
    const { lines } = readStatement(rows, guessMapping(rows))
    const preview = previewImport(db, { lines })
    expect(preview.map((l) => [l.description, l.category, l.duplicate])).toEqual([
      ['CHAI POINT KORAMANGALA', 'Food & dining', false],
      ['NETFLIX.COM', 'Subscriptions', true],
      ['Mystery store', null, false],
    ])
    expect(importExpenses(db, { lines: preview.filter((l) => !l.duplicate), method: 'HDFC Diners card' })).toBe(2)
    // Importing the same file again finds both as duplicates.
    expect(previewImport(db, { lines }).every((l) => l.duplicate)).toBe(true)
    const csv = exportExpensesCSV(db, { from: '2026-10-01', to: '2026-10-31' })
    expect(csv.split('\n')[0]).toBe('Date,Description,Type,Category,Paid with,Amount (INR),Currency,Amount in currency,Rate,Note')
    expect(csv).toContain('2026-10-04,CHAI POINT KORAMANGALA,expense,Food & dining,HDFC Diners card,120,INR,,,')
  })
})
