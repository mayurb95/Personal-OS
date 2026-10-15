import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { formatDayWithWeekday, formatDay } from '../../engine/dates'
import type { Expense } from '../../engine/expenses'
import { BarChart, Meter } from '../../ui/Charts'
import { EmptyState, FloatingAdd } from '../../ui/Controls'
import { ChevronLeft, ChevronRight, Ellipsis } from '../../ui/Icons'
import { Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { primeKeyboard } from '../../ui/Sheet'
import { ExpenseSheet } from './ExpenseSheet'
import { categoryEmoji, inr, inrShort, monthLabel, shiftMonth } from './format'

/** Money: a month's spending against budgets, charts, and every expense and income. */
export function MoneyScreen() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? today.slice(0, 7)
  const category = params.get('category') ?? ''
  const { data: s } = useDbQuery('moneySummary', { month })
  const [from, to] = [`${month}-01`, `${month}-31`]
  const { data: list } = useDbQuery('listExpenses', { from, to, category: category || undefined })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  // Post any recurring expenses that came due since the app was opened.
  useEffect(() => {
    void act('postDueRecurring', { today })
  }, [today])

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const isCurrent = month === today.slice(0, 7)
  const byDay = new Map<string, Expense[]>()
  for (const e of list ?? []) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])

  return (
    <Page>
      <NavBar
        back={{ to: '/more', label: 'More' }}
        title="Money"
        right={
          <Link to="/money/settings" aria-label="Money settings" className="text-accent">
            <Ellipsis size={26} />
          </Link>
        }
      />
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <button type="button" aria-label="Previous month" onClick={() => go({ month: shiftMonth(month, -1) })} className="p-2 text-accent">
          <ChevronLeft size={22} />
        </button>
        <button type="button" onClick={() => go({ month: null })} className="text-[17px] font-semibold">
          {monthLabel(month)}
        </button>
        <button type="button" aria-label="Next month" disabled={isCurrent} onClick={() => go({ month: shiftMonth(month, 1) })} className="p-2 text-accent disabled:opacity-25">
          <ChevronRight size={22} />
        </button>
      </div>

      {s && (
        <div className="mx-4 mb-6 rounded-[14px] bg-card px-4 py-4">
          <div className="text-[13px] text-label-2">Spent{isCurrent ? ' this month' : ''}</div>
          <div className="text-[34px] font-bold leading-tight tabular-nums">{inr(s.spent)}</div>
          {s.budgetTotal ? (
            <div className="mt-2 space-y-1.5">
              <Meter value={s.spent} max={s.budgetTotal} label="Spent against monthly budget" />
              <div className="flex justify-between text-[13px] text-label-2">
                <span>of {inr(s.budgetTotal)} budget</span>
                <span className={s.spent > s.budgetTotal ? 'text-bad' : ''}>
                  {s.spent > s.budgetTotal ? `${inr(s.spent - s.budgetTotal)} over` : `${inr(s.budgetTotal - s.spent)} left`}
                </span>
              </div>
            </div>
          ) : (
            <Link to="/money/settings" className="mt-1 block text-[13px] text-accent">
              Set a monthly budget
            </Link>
          )}
          {s.income > 0 && (
            <div className="mt-3 flex justify-between border-t-[0.5px] border-separator pt-2 text-[15px]">
              <span className="text-label-2">Income</span>
              <span className="font-semibold text-good">{inr(s.income)}</span>
            </div>
          )}
        </div>
      )}

      {s && s.byCategory.length > 0 && (
        <Section title="By category" footer={category ? <button type="button" className="text-accent" onClick={() => go({ category: null })}>Show all categories</button> : 'Tap a category to see only its expenses.'}>
          {s.byCategory.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => go({ category: category === c.category ? null : c.category })}
              className={`block w-full border-b-[0.5px] border-separator px-4 py-2.5 text-left last:border-b-0 active:bg-card-pressed ${category === c.category ? 'bg-accent/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{categoryEmoji(c.category)}</span>
                <span className="min-w-0 flex-1 truncate">{c.category}</span>
                <span className="tabular-nums">{inr(c.spent)}</span>
              </div>
              {c.budget ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <Meter value={c.spent} max={c.budget} label={`${c.category} against budget`} />
                  <span className={`shrink-0 text-[12px] ${c.spent > c.budget ? 'text-bad' : 'text-label-2'}`}>
                    {Math.round((c.spent / c.budget) * 100)}% of {inrShort(c.budget)}
                  </span>
                </div>
              ) : null}
            </button>
          ))}
        </Section>
      )}

      {s && s.spent > 0 && (
        <>
          <Section title="Daily spending">
            <BarChart
              ariaLabel={`Spending per day in ${monthLabel(month)}`}
              data={s.daily.map((d) => ({ label: String(Number(d.day.slice(8))), detail: formatDayWithWeekday(d.day), value: d.spent }))}
              format={(v) => inr(v)}
              labelEvery={5}
            />
          </Section>
          <Section title="Last 6 months">
            <BarChart
              ariaLabel="Spending per month, last 6 months"
              data={s.months.map((m) => ({ label: monthLabel(m.month).slice(0, 3), detail: monthLabel(m.month), value: m.spent }))}
              format={(v) => inr(v)}
              limit={s.budgetTotal ?? undefined}
              highlightLast
            />
          </Section>
          {s.topMerchants.length > 1 && (
            <Section title="Where it went">
              {s.topMerchants.map((m) => (
                <Row key={m.title} label={m.title} detail={`${m.count} time${m.count === 1 ? '' : 's'}`} value={inr(m.spent)} />
              ))}
            </Section>
          )}
        </>
      )}

      {list && list.length === 0 && (
        <EmptyState title={category ? `No ${category} this month` : 'Nothing logged this month'}>
          Tap + to add an expense, or import a bank or card statement from the ••• menu.
        </EmptyState>
      )}
      {[...byDay.entries()].map(([day, items]) => (
        <Section key={day} title={`${formatDay(day, today)} · ${inr(items.filter((e) => e.type === 'expense').reduce((t, e) => t + e.amount, 0))}`}>
          {items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                primeKeyboard()
                setEditing(e)
              }}
              className="flex w-full items-center gap-3 border-b-[0.5px] border-separator py-2.5 pl-4 pr-4 text-left last:border-b-0 active:bg-card-pressed"
            >
              <span className="text-[20px]" aria-hidden="true">{categoryEmoji(e.category)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{e.title}</div>
                <div className="truncate text-[13px] text-label-2">
                  {[e.category !== e.title ? e.category : '', e.method, e.recurringId ? 'Recurring' : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-right">
                <div className={`tabular-nums ${e.type === 'income' ? 'text-good' : ''}`}>
                  {e.type === 'income' ? '+' : ''}
                  {inr(e.amount, true)}
                </div>
                {e.currency && (
                  <div className="text-[12px] text-label-2">
                    {e.originalAmount} {e.currency}
                  </div>
                )}
              </div>
            </button>
          ))}
        </Section>
      ))}

      <FloatingAdd
        label="New expense"
        onClick={() => {
          primeKeyboard()
          setAdding(true)
        }}
      />
      <ExpenseSheet open={adding} onClose={() => setAdding(false)} />
      <ExpenseSheet open={editing !== null} onClose={() => setEditing(null)} editing={editing} />
    </Page>
  )
}
