import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { act } from '../../app/data'
import { formatDay } from '../../engine/dates'
import type { Habit, HabitStatus } from '../../engine/habits'
import { CheckCircle } from '../../ui/Controls'
import { Flame, Plus } from '../../ui/Icons'
import { Sheet } from '../../ui/Sheet'

export const KIND_LABELS: Record<Habit['kind'], string> = {
  check: 'Yes or no',
  count: 'Count toward a target',
  measure: 'Number with a unit',
  duration: 'Time spent',
  scale: 'Score from 1 to 5',
  limit: 'Keep under a limit',
}

export function formatValue(habit: Habit, value: number): string {
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (habit.kind === 'duration') {
    const h = Math.floor(value / 60)
    const m = Math.round(value % 60)
    return h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`
  }
  return habit.unit ? `${v} ${habit.unit}` : v
}

/** "3 of 8 glasses", "7.5 h of 7 h", "Streak 12 days" … the line under a habit's name. */
export function habitProgress(s: HabitStatus): string {
  const h = s.habit
  const value = s.today?.skipped ? null : s.today?.value ?? 0
  const parts: string[] = []
  if (s.today?.skipped) parts.push('Rest day')
  else if (h.kind === 'count' || h.kind === 'measure' || h.kind === 'duration') {
    parts.push(`${formatValue(h, value ?? 0)} of ${formatValue(h, h.target)}`)
  } else if (h.kind === 'limit') {
    parts.push(`${value ?? 0} of max ${h.target}${h.unit ? ` ${h.unit}` : ''}`)
  } else if (h.kind === 'scale' && value) parts.push(`Scored ${value}`)
  if (h.schedule.type === 'weekly') parts.push(`${s.weekCount}/${h.schedule.times} this week`)
  return parts.join(' · ')
}

/** A habit with its one-tap action: tick, +1, or a sheet to enter a value. */
export function HabitRow({ status, today }: { status: HabitStatus; today: string }) {
  const h = status.habit
  const [valueOpen, setValueOpen] = useState(false)
  const progress = habitProgress(status)
  const skipped = status.today?.skipped ?? false

  const tap = () => {
    if (h.kind === 'check' || h.kind === 'count' || h.kind === 'limit') {
      void act('tapHabit', { habitId: h.id, day: today })
    } else setValueOpen(true)
  }

  let control: React.ReactNode
  if (h.kind === 'check') {
    control = <CheckCircle checked={status.doneToday} onToggle={tap} tone="good" label={`Mark “${h.name}” done`} size={28} />
  } else if (h.kind === 'count' || h.kind === 'limit') {
    const over = h.kind === 'limit' && (status.today?.value ?? 0) > h.target
    control = (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          tap()
        }}
        aria-label={`Add one to “${h.name}”`}
        className={`flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-full px-2 text-[15px] font-semibold ${
          status.doneToday ? 'bg-good text-white' : over ? 'bg-bad text-white' : 'bg-accent/15 text-accent'
        }`}
      >
        <Plus size={16} />
        {status.today && !skipped ? status.today.value : ''}
      </button>
    )
  } else {
    control = (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          tap()
        }}
        className={`h-9 rounded-full px-3 text-[15px] font-semibold ${
          status.doneToday ? 'bg-good text-white' : 'bg-accent/15 text-accent'
        }`}
      >
        {status.today && !skipped ? formatValue(h, status.today.value) : 'Log'}
      </button>
    )
  }

  return (
    <>
      <Link
        to={`/habits/${h.id}`}
        className="flex items-center gap-3 border-b-[0.5px] border-separator py-2.5 pl-4 pr-4 last:border-b-0 active:bg-card-pressed"
      >
        <div className="min-w-0 flex-1">
          <div className={status.doneToday ? 'text-label-2' : ''}>{h.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-label-2">
            {status.streak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-warn">
                <Flame size={13} />
                {status.streak}
              </span>
            )}
            {progress && <span>{progress}</span>}
          </div>
        </div>
        {control}
      </Link>
      <HabitValueSheet
        open={valueOpen}
        onClose={() => setValueOpen(false)}
        habit={h}
        day={today}
        today={today}
        current={status.today?.skipped ? null : status.today?.value ?? null}
      />
    </>
  )
}

/** Enter a value for a day (and mark rest days). Used for measures, durations and scores, and for past days. */
export function HabitValueSheet({
  open,
  onClose,
  habit,
  day,
  today,
  current,
}: {
  open: boolean
  onClose: () => void
  habit: Habit
  day: string
  today: string
  current: number | null
}) {
  const [text, setText] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')

  useEffect(() => {
    if (!open) return
    if (habit.kind === 'duration' && current) {
      setHours(current >= 60 ? String(Math.floor(current / 60)) : '')
      setMinutes(String(Math.round(current % 60)))
    } else {
      setText(current ? String(current) : '')
      setHours('')
      setMinutes('')
    }
  }, [open, current, habit.kind])

  const save = async (value: number, skipped = false) => {
    await act('logHabit', { habitId: habit.id, day, value, skipped })
    onClose()
  }

  const submit = () => {
    if (habit.kind === 'duration') void save((Number(hours) || 0) * 60 + (Number(minutes) || 0))
    else void save(Number(text.replace(',', '.')) || 0)
  }

  const title = day === today ? habit.name : `${habit.name} · ${formatDay(day, today)}`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      right={
        habit.kind === 'scale' ? undefined : (
          <button type="button" onClick={submit} className="text-[17px] font-semibold text-accent">
            Save
          </button>
        )
      }
    >
      <div className="px-4 pb-4">
        {habit.kind === 'scale' ? (
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => void save(n)}
                className={`h-14 flex-1 rounded-[12px] text-[20px] font-semibold ${
                  current === n ? 'bg-accent text-white' : 'bg-card'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        ) : habit.kind === 'duration' ? (
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-[10px] bg-card px-4 py-3">
              <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" placeholder="0" className="w-full bg-transparent outline-none" aria-label="Hours" />
              <span className="text-label-2">h</span>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-[10px] bg-card px-4 py-3">
              <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" placeholder="0" className="w-full bg-transparent outline-none" aria-label="Minutes" />
              <span className="text-label-2">min</span>
            </label>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="flex items-center gap-2 rounded-[10px] bg-card px-4 py-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                enterKeyHint="done"
                className="w-full bg-transparent outline-none"
                aria-label="Value"
              />
              {habit.unit && <span className="text-label-2">{habit.unit}</span>}
            </label>
          </form>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void save(0, true)}
            className="flex-1 rounded-[10px] bg-card py-3 text-[15px] text-accent"
          >
            Rest day
          </button>
          <button
            type="button"
            onClick={() => void save(0)}
            className="flex-1 rounded-[10px] bg-card py-3 text-[15px] text-bad"
          >
            Clear
          </button>
        </div>
        <p className="mt-2 text-[13px] text-label-2">A rest day doesn’t break your streak.</p>
      </div>
    </Sheet>
  )
}
