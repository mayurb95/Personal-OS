import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { act, useDbQuery, useToday } from '../app/data'
import { formatDayWithWeekday } from '../engine/dates'
import type { HabitStatus, PartOfDay } from '../engine/habits'
import { EmptyState, FloatingAdd } from '../ui/Controls'
import { CloudUp, SearchIcon } from '../ui/Icons'
import { Section } from '../ui/List'
import { Screen } from '../ui/Screen'
import { primeKeyboard } from '../ui/Sheet'
import { showToast } from '../ui/Toast'
import { HabitRow } from './habits/HabitRow'
import { moodFace, MOODS } from './journal/JournalScreens'
import { ExpenseSheet } from './money/ExpenseSheet'
import { inr } from './money/format'
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
  const backup = useDbQuery('backupStatus').data
  const active = useDbQuery('activeSession').data
  const planned = useDbQuery('plannedWorkouts', { today }).data ?? []
  const spend = useDbQuery('spendingSnapshot', { today }).data
  const journal = useDbQuery('journalDay', { day: today }).data
  const navigate = useNavigate()
  const [addingExpense, setAddingExpense] = useState(false)
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

      {backup && backup.summary.records > 0 && (!backup.last || Date.now() - new Date(backup.last).getTime() > 7 * 86_400_000) && (
        <Link to="/backup" className="mx-4 mb-6 flex items-center gap-3 rounded-[12px] bg-warn/15 px-4 py-3 active:opacity-70">
          <CloudUp size={22} className="shrink-0 text-warn" />
          <span className="text-[15px] leading-snug">
            {backup.last ? 'Your last backup was over a week ago.' : 'You haven’t backed up yet.'}{' '}
            <span className="font-semibold text-accent">Back up now</span>
          </span>
        </Link>
      )}

      {active ? (
        <Link to={`/workouts/session/${active.id}`} className="mx-4 mb-6 flex items-center gap-3 rounded-[12px] bg-accent px-4 py-3 text-white active:opacity-80">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] opacity-80">Workout in progress</div>
            <div className="truncate font-semibold">{active.name}</div>
          </div>
          <span className="font-semibold">Resume</span>
        </Link>
      ) : (
        planned
          .filter((p) => !p.doneToday)
          .map((p) => (
            <div key={p.routine.id} className="mx-4 mb-6 flex items-center gap-3 rounded-[12px] bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-label-2">Planned workout</div>
                <div className="truncate font-semibold">{p.routine.name}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const s = await act('startSession', { today, routineId: p.routine.id })
                  if (s) navigate(`/workouts/session/${s.id}`)
                }}
                className="rounded-full bg-accent px-3.5 py-1.5 text-[15px] font-semibold text-white"
              >
                Start
              </button>
            </div>
          ))
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

      <Section title="Money">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/money" className="min-w-0 flex-1">
            <div className="text-[20px] font-semibold tabular-nums">{spend ? inr(spend.today) : '…'}</div>
            <div className="text-[13px] text-label-2">
              spent today{spend ? ` · ${inr(spend.month)} this month${spend.budget ? ` of ${inr(spend.budget)}` : ''}` : ''}
            </div>
          </Link>
          <button
            type="button"
            onClick={() => {
              primeKeyboard()
              setAddingExpense(true)
            }}
            className="rounded-full bg-accent/15 px-3.5 py-1.5 text-[15px] font-semibold text-accent"
          >
            + Expense
          </button>
        </div>
      </Section>

      <Section title="Journal">
        {journal?.entry ? (
          <Link to="/journal" className="flex items-center gap-3 px-4 py-3 active:bg-card-pressed">
            <span className="text-[28px]">{moodFace(journal.entry.mood)}</span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[15px] text-label-2">
              {journal.entry.text || journal.entry.emotions.join(', ') || 'Mood logged'}
            </span>
          </Link>
        ) : (
          <div className="px-4 py-3">
            <div className="mb-2 text-[15px]">How’s today going?</div>
            <div className="flex justify-between">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-label={m.label}
                  onClick={() => void act('saveEntry', { day: today, mood: m.value, prompt: journal?.prompt })}
                  className="text-[30px] leading-none active:scale-110"
                >
                  {m.face}
                </button>
              ))}
            </div>
            <Link to="/journal" className="mt-2 block text-[13px] text-accent">
              Write in your journal
            </Link>
          </div>
        )}
      </Section>

      <ExpenseSheet open={addingExpense} onClose={() => setAddingExpense(false)} />

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
