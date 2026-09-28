import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { addDays, formatDay, MONTH_SHORT, startOfWeek, WEEKDAY_SHORT, weekday } from '../../engine/dates'
import { type Habit, type HabitLog, isDone, isScheduled } from '../../engine/habits'
import { Archive, Flame, Trash } from '../../ui/Icons'
import { ButtonRow, Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { showToast } from '../../ui/Toast'
import { formatValue, HabitRow, HabitValueSheet, KIND_LABELS } from './HabitRow'

const WEEKS = 26

export function describeSchedule(h: Habit): string {
  const s = h.schedule
  switch (s.type) {
    case 'weekdays':
      return s.days.length === 5 && s.days.every((d, i) => d === i)
        ? 'Weekdays'
        : s.days.map((d) => WEEKDAY_SHORT[d]).join(', ')
    case 'weekly':
      return `${s.times} time${s.times === 1 ? '' : 's'} a week`
    case 'interval':
      return `Every ${s.every} days`
    default:
      return 'Every day'
  }
}

export function HabitDetailScreen() {
  const { id = '' } = useParams()
  const today = useToday()
  const navigate = useNavigate()
  const { data: status, error } = useDbQuery('getHabitStatus', { id, today })
  const from = addDays(startOfWeek(today), -7 * (WEEKS - 1))
  const logs = useDbQuery('habitLogs', { habitId: id, from, to: today }).data ?? []
  const [editDay, setEditDay] = useState<string | null>(null)

  if (error) {
    return (
      <Page>
        <NavBar back={{ to: '/habits', label: 'Habits' }} />
        <p className="p-8 text-center text-label-2">{error}</p>
      </Page>
    )
  }
  if (!status) return <NavBar back={{ to: '/habits', label: 'Habits' }} />
  const h = status.habit
  const byDay = new Map(logs.map((l) => [l.day, l]))

  const tapDay = (day: string) => {
    if (day > today || day < h.startDate) return
    if (h.kind === 'check') {
      const log = byDay.get(day)
      void act('logHabit', { habitId: h.id, day, value: log && !log.skipped ? 0 : 1 })
    } else setEditDay(day)
  }

  const archive = async () => {
    await act('updateHabit', { id: h.id, archived: !h.archived })
    showToast(h.archived ? 'Habit restored' : 'Habit archived')
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${h.name}” and its history? You can restore it from the trash for 30 days.`)) return
    await act('trashRecord', { id: h.id })
    navigate('/habits', { replace: true })
  }

  const unit = status.streakUnit === 'weeks' ? 'weeks' : 'days'

  return (
    <Page>
      <NavBar
        back={{ to: '/habits', label: 'Habits' }}
        title={h.name}
        right={
          <Link to={`/habits/${h.id}/edit`} className="text-[17px] text-accent">
            Edit
          </Link>
        }
      />
      <div className="mx-4 mb-8 mt-4 grid grid-cols-3 gap-3">
        <Stat label={`Streak (${unit})`} value={status.streak} icon />
        <Stat label={`Best (${unit})`} value={status.bestStreak} />
        <Stat label="Last 30 days" value={`${status.rate30}%`} />
      </div>

      {!h.archived && (
        <Section title="Today">
          <HabitRow status={status} today={today} />
        </Section>
      )}

      <Section
        title={`Last ${WEEKS} weeks`}
        footer={h.kind === 'check' ? 'Tap a day to tick or untick it.' : 'Tap a day to enter or change its value.'}
      >
        <Heatmap habit={h} logs={byDay} from={from} today={today} onTap={tapDay} />
      </Section>

      <Section title="About">
        <Row label="Type" value={KIND_LABELS[h.kind]} />
        {(h.kind === 'count' || h.kind === 'measure' || h.kind === 'duration') && (
          <Row label="Daily target" value={formatValue(h, h.target)} />
        )}
        {h.kind === 'limit' && <Row label="Limit" value={`${h.target}${h.unit ? ` ${h.unit}` : ''} a day`} />}
        <Row label="Schedule" value={describeSchedule(h)} />
        <Row label="Time of day" value={h.partOfDay[0]!.toUpperCase() + h.partOfDay.slice(1)} />
        <Row label="Started" value={formatDay(h.startDate, today)} />
        {h.notes && <Row label="Notes" detail={h.notes} />}
      </Section>

      <Section>
        <ButtonRow onClick={archive}>
          <span className="flex items-center gap-2">
            <Archive size={18} /> {h.archived ? 'Restore habit' : 'Archive habit'}
          </span>
        </ButtonRow>
        <ButtonRow tone="bad" onClick={remove}>
          <span className="flex items-center gap-2">
            <Trash size={18} /> Delete habit
          </span>
        </ButtonRow>
      </Section>

      {editDay && (
        <HabitValueSheet
          open
          onClose={() => setEditDay(null)}
          habit={h}
          day={editDay}
          today={today}
          current={byDay.get(editDay)?.skipped ? null : byDay.get(editDay)?.value ?? null}
        />
      )}
    </Page>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: boolean }) {
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

function cellClass(habit: Habit, day: string, log: HabitLog | undefined, today: string): string {
  if (day > today) return 'bg-transparent'
  if (day < habit.startDate) return 'bg-label-3/10'
  if (log?.skipped) return 'bg-label-3/50'
  if (isDone(habit, log) && (habit.kind !== 'limit' || day < today)) {
    if (habit.kind === 'limit' && !log) return 'bg-good/60'
    return 'bg-good'
  }
  if (log && log.value > 0) return habit.kind === 'limit' ? 'bg-bad/70' : 'bg-good/40'
  if (habit.schedule.type !== 'weekly' && !isScheduled(habit, day)) return 'bg-label-3/10'
  return 'bg-label-3/25'
}

/** GitHub-style grid: one column per week, Monday at the top. */
function Heatmap({
  habit,
  logs,
  from,
  today,
  onTap,
}: {
  habit: Habit
  logs: Map<string, HabitLog>
  from: string
  today: string
  onTap: (day: string) => void
}) {
  const weeks = Array.from({ length: WEEKS }, (_, w) => addDays(from, w * 7))
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Start at the most recent weeks.
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])
  return (
    <div ref={scroller} className="overflow-x-auto px-4 py-3">
      <div className="flex gap-[3px]">
        <div className="mr-1 flex flex-col gap-[3px] pt-4 text-[9px] leading-[11px] text-label-2">
          {WEEKDAY_SHORT.map((d, i) => (
            <span key={d} className="h-[11px]">
              {i % 2 === 0 ? d.slice(0, 1) : ''}
            </span>
          ))}
        </div>
        {weeks.map((monday) => {
          const month = Number(monday.slice(5, 7))
          const showMonth = Number(monday.slice(8, 10)) <= 7
          return (
            <div key={monday} className="flex flex-col gap-[3px]">
              <span className="h-[13px] text-[9px] text-label-2">{showMonth ? MONTH_SHORT[month - 1] : ''}</span>
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(monday, i)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={`${formatDay(day, today)}`}
                    onClick={() => onTap(day)}
                    className={`h-[11px] w-[11px] rounded-[2.5px] ${cellClass(habit, day, logs.get(day), today)} ${
                      day === today ? 'ring-1 ring-accent' : ''
                    }`}
                    disabled={day > today || day < habit.startDate || weekday(day) !== i}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
