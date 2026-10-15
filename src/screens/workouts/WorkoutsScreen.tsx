import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { formatDay, MONTH_SHORT } from '../../engine/dates'
import type { SessionSummary } from '../../engine/workouts'
import { BarChart } from '../../ui/Charts'
import { Flame, Plus } from '../../ui/Icons'
import { Row, Section } from '../../ui/List'
import { Screen } from '../../ui/Screen'
import { kg, km, minutes, volume, WEEKDAY_LETTERS } from './format'

function weekLabel(monday: string): string {
  return `${Number(monday.slice(8))} ${MONTH_SHORT[Number(monday.slice(5, 7)) - 1]}`
}

export function sessionLine(s: SessionSummary): string {
  const parts = [minutes(s.durationS), `${s.sets} sets`]
  if (s.volumeKg) parts.push(volume(s.volumeKg))
  if (s.distanceM) parts.push(`${km(s.distanceM)} km`)
  return parts.join(' · ')
}

/** Workouts home: what's planned today, this week's progress, routines and shortcuts. */
export function WorkoutsScreen() {
  const today = useToday()
  const navigate = useNavigate()
  const active = useDbQuery('activeSession').data
  const planned = useDbQuery('plannedWorkouts', { today }).data ?? []
  const routines = useDbQuery('listRoutines').data ?? []
  const stats = useDbQuery('workoutStats', { today, weeks: 8 }).data
  const recent = useDbQuery('listSessions', { limit: 3 }).data ?? []
  const weights = useDbQuery('bodyWeights').data ?? []
  const [starting, setStarting] = useState(false)

  const start = async (routineId?: string) => {
    setStarting(true)
    const s = await act('startSession', { today, routineId })
    setStarting(false)
    if (s) navigate(`/workouts/session/${s.id}`)
  }

  const latestWeight = weights.at(-1)

  return (
    <Screen title="Workouts">
      {active && (
        <Link
          to={`/workouts/session/${active.id}`}
          className="mx-4 mb-6 flex items-center gap-3 rounded-[12px] bg-accent px-4 py-3 text-white active:opacity-80"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] opacity-80">In progress</div>
            <div className="truncate text-[17px] font-semibold">{active.name}</div>
          </div>
          <span className="font-semibold">Resume</span>
        </Link>
      )}

      <Section title="Today">
        {planned.map(({ routine, doneToday }) => (
          <div key={routine.id} className="flex items-center gap-3 border-b-[0.5px] border-separator py-2.5 pl-4 pr-4">
            <Link to={`/workouts/routines/${routine.id}`} className="min-w-0 flex-1">
              <div className="truncate">{routine.name}</div>
              <div className="text-[13px] text-label-2">{routine.items.length} exercises</div>
            </Link>
            {doneToday ? (
              <span className="text-[15px] font-semibold text-good">Done</span>
            ) : (
              <button
                type="button"
                disabled={starting || Boolean(active)}
                onClick={() => void start(routine.id)}
                className="rounded-full bg-accent px-3.5 py-1.5 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                Start
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={starting || Boolean(active)}
          onClick={() => void start()}
          className="block min-h-11 w-full px-4 py-2.5 text-left text-accent active:bg-card-pressed disabled:opacity-40"
        >
          Start an empty workout
        </button>
      </Section>

      {stats && (
        <>
          <div className="mx-4 mb-3 grid grid-cols-3 gap-3">
            <Tile value={stats.thisWeek} label="This week" />
            <Tile value={stats.thisMonth} label="This month" />
            <Tile value={stats.weekStreak} label="Week streak" icon />
          </div>
          <Section title="Workouts per week">
            <BarChart
              ariaLabel="Workouts per week, last 8 weeks"
              data={stats.weekly.map((w) => ({
                label: weekLabel(w.weekStart),
                detail: `Week of ${weekLabel(w.weekStart)} · ${w.sets} sets`,
                value: w.sessions,
              }))}
              format={(v) => `${v} workout${v === 1 ? '' : 's'}`}
              labelEvery={2}
              highlightLast
            />
          </Section>
          {stats.muscles.length > 0 && (
            <Section title="Sets per muscle" footer="Completed sets this week, with last week for comparison.">
              {stats.muscles.map((m) => (
                <Row key={m.muscle} label={m.muscle} value={`${m.thisWeek}  ·  ${m.lastWeek} last wk`} />
              ))}
            </Section>
          )}
        </>
      )}

      <Section title="Routines" footer={routines.length ? undefined : 'A routine is a planned workout, like “Push day”, with its exercises and the days you do it.'}>
        {routines.map((r) => (
          <Link key={r.id} to={`/workouts/routines/${r.id}`} className="block">
            <Row
              label={r.name}
              detail={`${r.items.length} exercises${r.lastDone ? ` · last ${formatDay(r.lastDone, today)}` : ''}`}
              value={
                <span className="flex gap-0.5 text-[11px]">
                  {WEEKDAY_LETTERS.map((d, i) => (
                    <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full ${r.weekdays.includes(i) ? 'bg-accent text-white' : 'text-label-3'}`}>
                      {d}
                    </span>
                  ))}
                </span>
              }
            />
          </Link>
        ))}
        <Link to="/workouts/routines/new" className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-accent active:bg-card-pressed">
          <Plus size={18} /> New routine
        </Link>
      </Section>

      <Section title="Recent">
        {recent.map((s) => (
          <Link key={s.id} to={`/workouts/session/${s.id}`} className="block">
            <Row label={s.name} detail={`${formatDay(s.day, today)} · ${sessionLine(s)}`} />
          </Link>
        ))}
        <Link to="/workouts/history" className="block">
          <Row label={<span className="text-accent">All workouts</span>} />
        </Link>
      </Section>

      <Section>
        <Link to="/workouts/exercises" className="block">
          <Row label="Exercises and records" />
        </Link>
        <Link to="/workouts/body" className="block">
          <Row label="Body weight" value={latestWeight ? `${kg(latestWeight.weightKg)} kg` : 'Add'} />
        </Link>
      </Section>
    </Screen>
  )
}

function Tile({ value, label, icon }: { value: number; label: string; icon?: boolean }) {
  return (
    <div className="rounded-[12px] bg-card p-3">
      <div className="flex items-center gap-1 text-[26px] font-bold leading-none">
        {icon && <Flame size={20} className="text-warn" />}
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-label-2">{label}</div>
    </div>
  )
}
