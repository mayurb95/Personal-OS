import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { addDays, formatDay, MONTH_SHORT } from '../../engine/dates'
import { MUSCLES } from '../../engine/seed'
import { formatDuration, type Exercise } from '../../engine/workouts'
import { LineChart } from '../../ui/Charts'
import { EmptyState } from '../../ui/Controls'
import { SearchIcon } from '../../ui/Icons'
import { ButtonRow, Row, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { ExercisePicker } from './ExercisePicker'
import { KIND_LABEL, kg, km } from './format'
import { sessionLine } from './WorkoutsScreen'

const shortDate = (day: string) => `${Number(day.slice(8))} ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}`

export function ExercisesScreen() {
  const today = useToday()
  const navigate = useNavigate()
  const { data } = useDbQuery('listExercises')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, Exercise[]>()
    for (const e of data ?? []) {
      if (q && !e.name.toLowerCase().includes(q)) continue
      map.set(e.muscle || 'Other', [...(map.get(e.muscle || 'Other') ?? []), e])
    }
    const order = [...MUSCLES, 'Other'] as string[]
    return [...map.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  }, [data, query])

  return (
    <Page>
      <NavBar back={{ to: '/workouts', label: 'Workouts' }} title="Exercises" right={<BarButton onClick={() => setAdding(true)}>New</BarButton>} />
      <div className="px-4 pb-4 pt-3">
        <label className="flex items-center gap-2 rounded-[10px] bg-label-3/20 px-3 py-2">
          <SearchIcon size={18} className="text-label-2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2" aria-label="Search exercises" />
        </label>
      </div>
      {groups.map(([muscle, list]) => (
        <Section key={muscle} title={muscle}>
          {list.map((e) => (
            <Link key={e.id} to={`/workouts/exercises/${e.id}`} className="block">
              <Row label={e.name} value={e.lastDone ? formatDay(e.lastDone, today) : ''} />
            </Link>
          ))}
        </Section>
      ))}
      <ExercisePicker open={adding} onClose={() => setAdding(false)} onPick={(e) => navigate(`/workouts/exercises/${e.id}`)} />
    </Page>
  )
}

export function ExerciseDetailScreen() {
  const { id = '' } = useParams()
  const today = useToday()
  const { data, error } = useDbQuery('exerciseProgress', { id })

  if (error) {
    return (
      <Page>
        <NavBar back={{ to: '/workouts/exercises', label: 'Exercises' }} />
        <p className="p-8 text-center text-label-2">{error}</p>
      </Page>
    )
  }
  if (!data) return <NavBar back={{ to: '/workouts/exercises', label: 'Exercises' }} />
  const { exercise: e, points, records } = data
  const metric =
    e.kind === 'weight' ? 'Estimated 1RM (kg)' : e.kind === 'reps' ? 'Most reps in a set' : e.kind === 'time' ? 'Longest time' : 'Distance (km)'
  const fmt = (v: number) =>
    e.kind === 'weight' ? `${Math.round(v * 10) / 10} kg` : e.kind === 'time' ? formatDuration(v) : e.kind === 'distance' ? `${v} km` : String(v)

  const rename = async () => {
    const name = window.prompt('Exercise name', e.name)
    if (name?.trim()) await act('updateExercise', { id, name })
  }

  return (
    <Page>
      <NavBar back={{ to: '/workouts/exercises', label: 'Exercises' }} title={e.name} />
      <div className="px-4 pb-4 pt-4">
        <h1 className="text-[28px] font-bold leading-tight">{e.name}</h1>
        <div className="text-[15px] text-label-2">
          {[e.muscle, e.equipment !== 'None' ? e.equipment : '', KIND_LABEL[e.kind]].filter(Boolean).join(' · ')}
        </div>
      </div>
      {points.length === 0 ? (
        <EmptyState title="No history yet">Log this exercise in a workout and its progress shows here.</EmptyState>
      ) : (
        <>
          <Section title={metric}>
            <LineChart
              ariaLabel={`${metric} per workout`}
              data={points.map((p) => ({ label: shortDate(p.day), detail: formatDay(p.day, today), value: p.value }))}
              format={fmt}
              zeroBased={e.kind !== 'weight'}
            />
          </Section>
          <Section title="Records">
            {records.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} detail={r.day ? formatDay(r.day, today) : undefined} />
            ))}
          </Section>
          <Section title="History">
            {[...points].reverse().slice(0, 30).map((p) => (
              <Link key={p.sessionId} to={`/workouts/session/${p.sessionId}`} className="block">
                <Row
                  label={formatDay(p.day, today)}
                  detail={p.sets
                    .map((s) =>
                      e.kind === 'weight'
                        ? `${kg(s.weightKg)}×${s.reps ?? 0}`
                        : e.kind === 'reps'
                          ? `${s.reps ?? 0}`
                          : e.kind === 'time'
                            ? formatDuration(s.durationS ?? 0)
                            : `${km(s.distanceM)} km${s.durationS ? ` in ${formatDuration(s.durationS)}` : ''}`,
                    )
                    .join(', ')}
                />
              </Link>
            ))}
          </Section>
        </>
      )}
      <Section>
        <ButtonRow onClick={rename}>Rename</ButtonRow>
        <ButtonRow tone="bad" onClick={() => void act('updateExercise', { id, archived: !e.archived })}>
          {e.archived ? 'Show in exercise lists again' : 'Hide from exercise lists'}
        </ButtonRow>
      </Section>
    </Page>
  )
}

export function HistoryScreen() {
  const today = useToday()
  const { data } = useDbQuery('listSessions', { limit: 500 })
  const byMonth = new Map<string, NonNullable<typeof data>>()
  for (const s of data ?? []) byMonth.set(s.day.slice(0, 7), [...(byMonth.get(s.day.slice(0, 7)) ?? []), s])
  return (
    <Page>
      <NavBar back={{ to: '/workouts', label: 'Workouts' }} title="All workouts" />
      <div className="pt-4" />
      {data && data.length === 0 && <EmptyState title="No workouts yet">Finished workouts show up here.</EmptyState>}
      {[...byMonth.entries()].map(([month, list]) => (
        <Section key={month} title={`${MONTH_SHORT[Number(month.slice(5)) - 1]} ${month.slice(0, 4)} · ${list.length}`}>
          {list.map((s) => (
            <Link key={s.id} to={`/workouts/session/${s.id}`} className="block">
              <Row label={s.name} detail={`${formatDay(s.day, today)} · ${sessionLine(s)}`} />
            </Link>
          ))}
        </Section>
      ))}
    </Page>
  )
}

export function BodyWeightScreen() {
  const today = useToday()
  const { data } = useDbQuery('bodyWeights', { from: addDays(today, -365) })
  const [text, setText] = useState('')
  const [day, setDay] = useState(today)
  const save = async () => {
    const v = Number(text.replace(',', '.'))
    if (!text.trim() || !Number.isFinite(v)) return
    const ok = await act('logBodyWeight', { day, weightKg: v })
    if (ok !== undefined) setText('')
  }
  const list = data ?? []
  return (
    <Page>
      <NavBar back={{ to: '/workouts', label: 'Workouts' }} title="Body weight" />
      <div className="pt-4" />
      <Section footer="Weigh yourself at the same time of day, e.g. after waking up, for a steadier trend.">
        <form
          className="flex items-center gap-3 px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} className="bg-transparent text-accent outline-none" aria-label="Date" />
          <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder="kg" enterKeyHint="done" className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-label-3" aria-label="Weight in kg" />
          <span className="text-label-2">kg</span>
          <button type="submit" disabled={!text.trim()} className="rounded-full bg-accent px-3 py-1 text-[15px] font-semibold text-white disabled:opacity-30">
            Save
          </button>
        </form>
      </Section>
      {list.length > 1 && (
        <Section title="Last 12 months">
          <LineChart ariaLabel="Body weight over time" data={list.map((w) => ({ label: shortDate(w.day), detail: formatDay(w.day, today), value: w.weightKg }))} format={(v) => `${v} kg`} />
        </Section>
      )}
      {list.length > 0 && (
        <Section title="Entries">
          {[...list].reverse().slice(0, 60).map((w) => (
            <Row
              key={w.day}
              label={formatDay(w.day, today)}
              value={`${kg(w.weightKg)} kg`}
              action={
                <button type="button" aria-label={`Delete ${w.day}`} onClick={() => void act('logBodyWeight', { day: w.day, weightKg: null })} className="text-[18px] text-label-3">
                  ×
                </button>
              }
            />
          ))}
        </Section>
      )}
    </Page>
  )
}
