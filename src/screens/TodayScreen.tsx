import { useState } from 'react'
import { Link } from 'react-router'
import { act, useDbQuery, useToday } from '../app/data'
import { formatDayWithWeekday } from '../engine/dates'
import type { HabitStatus, PartOfDay } from '../engine/habits'
import { EmptyState, FloatingAdd } from '../ui/Controls'
import { SearchIcon } from '../ui/Icons'
import { Section } from '../ui/List'
import { Screen } from '../ui/Screen'
import { primeKeyboard } from '../ui/Sheet'
import { showToast } from '../ui/Toast'
import { HabitRow } from './habits/HabitRow'
import { QuickAddSheet } from './tasks/QuickAddSheet'
import { TaskRow } from './tasks/TaskRow'

function greeting(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const PARTS: { key: PartOfDay; title: string }[] = [
  { key: 'morning', title: 'Morning habits' },
  { key: 'anytime', title: 'Habits' },
  { key: 'evening', title: 'Evening habits' },
]

/** The home screen: today's habits and tasks, with quick add. */
export function TodayScreen() {
  const today = useToday()
  const { data } = useDbQuery('todaySummary', { today })
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const moveOverdueToToday = async () => {
    if (!data) return
    for (const t of data.overdue) await act('updateTask', { id: t.id, due: today })
    showToast(`Moved ${data.overdue.length} to today`)
  }

  const habitsByPart = (part: PartOfDay): HabitStatus[] =>
    data?.habits.filter((h) => h.habit.partOfDay === part) ?? []
  const habitsLeft = data?.habits.filter((h) => h.scheduledToday && !h.doneToday && h.habit.kind !== 'limit').length ?? 0
  const nothing =
    data && !data.habits.length && !data.overdue.length && !data.dueToday.length && !data.doneToday.length

  return (
    <Screen
      title={greeting(new Date().getHours())}
      subtitle={formatDayWithWeekday(today)}
      actions={
        <Link to="/search" aria-label="Search">
          <SearchIcon size={24} />
        </Link>
      }
    >
      {data && (data.dueToday.length > 0 || habitsLeft > 0) && (
        <p className="-mt-2 mb-5 px-4 text-[15px] text-label-2">
          {[
            data.dueToday.length ? `${data.dueToday.length} task${data.dueToday.length === 1 ? '' : 's'} due` : '',
            data.overdue.length ? `${data.overdue.length} overdue` : '',
            habitsLeft ? `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} to do` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {nothing && (
        <EmptyState title="A clear day">
          Tap + to add a task, or set up habits in the Habits tab.
        </EmptyState>
      )}

      {PARTS.map(({ key, title }) => {
        const list = habitsByPart(key)
        if (!list.length) return null
        return (
          <Section key={key} title={title}>
            {list.map((s) => (
              <HabitRow key={s.habit.id} status={s} today={today} />
            ))}
          </Section>
        )
      })}

      {data && data.overdue.length > 0 && (
        <Section
          title="Overdue"
          footer={
            <button type="button" onClick={moveOverdueToToday} className="text-accent">
              Move all to today
            </button>
          }
        >
          {data.overdue.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
        </Section>
      )}

      {data && (data.dueToday.length > 0 || data.doneToday.length > 0) && (
        <Section
          title="Today"
          footer={
            data.doneToday.length > 0 ? (
              <button type="button" onClick={() => setShowDone((v) => !v)} className="text-accent">
                {showDone ? 'Hide' : 'Show'} {data.doneToday.length} completed
              </button>
            ) : undefined
          }
        >
          {data.dueToday.map((t) => (
            <TaskRow key={t.id} task={t} today={today} showDue={false} />
          ))}
          {showDone && data.doneToday.map((t) => <TaskRow key={t.id} task={t} today={today} showDue={false} />)}
          {data.dueToday.length === 0 && !showDone && (
            <div className="px-4 py-3 text-[15px] text-label-2">All done for today.</div>
          )}
        </Section>
      )}

      <FloatingAdd
        label="New task"
        onClick={() => {
          primeKeyboard()
          setAdding(true)
        }}
      />
      <QuickAddSheet
        open={adding}
        onClose={() => setAdding(false)}
        today={today}
        defaults={{ due: today }}
        hint="Added to today unless you type a date. Try: Call Ravi 5pm #work p1"
      />
    </Screen>
  )
}
