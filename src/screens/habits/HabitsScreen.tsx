import { Link, useNavigate } from 'react-router'
import { useDbQuery, useToday } from '../../app/data'
import { WEEKDAY_SHORT } from '../../engine/dates'
import type { DayState, HabitStatus } from '../../engine/habits'
import { EmptyState, FloatingAdd } from '../../ui/Controls'
import { Flame } from '../../ui/Icons'
import { Section } from '../../ui/List'
import { Screen } from '../../ui/Screen'
import { HabitRow } from './HabitRow'

export const STATE_CLASS: Record<DayState, string> = {
  done: 'bg-good',
  partial: 'bg-good/35',
  missed: 'bg-bad/25',
  skipped: 'bg-label-3/45',
  off: 'bg-label-3/15',
  future: 'bg-transparent ring-1 ring-inset ring-label-3/40',
  before: 'bg-transparent',
}

export function WeekStrip({ status }: { status: HabitStatus }) {
  return (
    <div className="flex gap-1.5" aria-label="This week">
      {status.week.map((d, i) => (
        <div key={d.day} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-label-2">{WEEKDAY_SHORT[i]!.slice(0, 1)}</span>
          <span className={`h-5 w-5 rounded-full ${STATE_CLASS[d.state]}`} title={`${d.day}: ${d.state}`} />
        </div>
      ))}
    </div>
  )
}

export function HabitsScreen() {
  const today = useToday()
  const navigate = useNavigate()
  const { data } = useDbQuery('listHabits', { today })

  return (
    <Screen title="Habits">
      {data && data.length === 0 && (
        <EmptyState title="No habits yet">
          Track anything daily: a yes/no habit, glasses of water, hours of sleep, minutes of reading.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <>
          <Section title="Today">
            {data.filter((s) => s.scheduledToday || s.habit.kind === 'limit').map((s) => (
              <HabitRow key={s.habit.id} status={s} today={today} />
            ))}
            {data.every((s) => !s.scheduledToday && s.habit.kind !== 'limit') && (
              <div className="px-4 py-3 text-label-2">Nothing scheduled today.</div>
            )}
          </Section>
          <Section title="This week">
            {data.map((s) => (
              <Link
                key={s.habit.id}
                to={`/habits/${s.habit.id}`}
                className="flex items-center gap-3 border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0 active:bg-card-pressed"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.habit.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[13px] text-label-2">
                    <Flame size={13} className={s.streak ? 'text-warn' : ''} />
                    {s.streak} {s.streakUnit === 'weeks' ? 'wk' : 'd'} · {s.rate30}% in 30 days
                  </div>
                </div>
                <WeekStrip status={s} />
              </Link>
            ))}
          </Section>
        </>
      )}
      <FloatingAdd label="New habit" onClick={() => navigate('/habits/new')} />
    </Screen>
  )
}
