import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { WEEKDAY_SHORT } from '../../engine/dates'
import { formatDuration, parseDuration, type Exercise, type RoutineItem } from '../../engine/workouts'
import { AutoTextarea } from '../../ui/Controls'
import { Plus } from '../../ui/Icons'
import { ButtonRow, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { ExercisePicker } from './ExercisePicker'
import { kg, km } from './format'

/** Create or edit a routine: name, days, exercises with sets, targets, rest and progression. */
export function RoutineEditScreen() {
  const { id } = useParams()
  const isNew = !id
  const today = useToday()
  const navigate = useNavigate()
  const existing = useDbQuery('getRoutine', { id: id ?? '' })
  const exercises = useDbQuery('listExercises', { includeArchived: true }).data ?? []
  const active = useDbQuery('activeSession').data
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [items, setItems] = useState<RoutineItem[]>([])
  const [picking, setPicking] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const r = existing.data
    if (isNew || !r) return
    setName(r.name)
    setNotes(r.notes)
    setWeekdays(r.weekdays)
    setItems(r.items)
  }, [existing.data, isNew])

  const byId = new Map(exercises.map((e) => [e.id, e]))
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }
  const setItem = (i: number, patch: Partial<RoutineItem>) => {
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))
    setDirty(true)
  }
  const move = (i: number, d: -1 | 1) => {
    setItems((list) => {
      const next = [...list]
      const j = i + d
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    const r = await act('saveRoutine', { id, name, notes, weekdays, items })
    if (r) {
      setDirty(false)
      if (isNew) navigate(`/workouts/routines/${r.id}`, { replace: true })
    }
    return r
  }

  const startNow = async () => {
    if (dirty && !(await save())) return
    const s = await act('startSession', { today, routineId: id })
    if (s) navigate(`/workouts/session/${s.id}`)
  }

  const remove = async () => {
    if (!window.confirm(`Delete the routine “${name}”? Past workouts stay in your history.`)) return
    await act('deleteRoutine', { id: id! })
    navigate('/workouts', { replace: true })
  }

  const addExercise = (e: Exercise) => {
    setPicking(false)
    setItems((list) => [
      ...list,
      e.kind === 'weight'
        ? { exerciseId: e.id, sets: 3, reps: 8, restS: 120, incrementKg: e.equipment === 'Dumbbell' ? 2 : 2.5 }
        : e.kind === 'reps'
          ? { exerciseId: e.id, sets: 3, reps: 12, restS: 60 }
          : { exerciseId: e.id, sets: 1, restS: 60 },
    ])
    setDirty(true)
  }

  return (
    <Page>
      <NavBar
        back={{ to: '/workouts', label: 'Workouts' }}
        title={isNew ? 'New routine' : 'Routine'}
        right={
          <BarButton bold onClick={() => void save()} disabled={!name.trim() || (!dirty && !isNew)}>
            Save
          </BarButton>
        }
      />
      <div className="pt-4" />
      <Section>
        <div className="px-4 py-3">
          <input
            value={name}
            onChange={(e) => change(setName)(e.target.value)}
            placeholder="Name, e.g. Push day"
            autoFocus={isNew}
            className="w-full bg-transparent text-[20px] font-semibold outline-none placeholder:text-label-3"
            aria-label="Routine name"
          />
        </div>
      </Section>

      <Section title="Days" footer="The routine shows on Today and Workouts on these days. Leave all off to start it whenever you like.">
        <div className="flex justify-between gap-1 px-4 py-3">
          {WEEKDAY_SHORT.map((d, i) => {
            const on = weekdays.includes(i)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => change(setWeekdays)(on ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())}
                className={`h-10 flex-1 rounded-full text-[13px] font-semibold ${on ? 'bg-accent text-white' : 'bg-label-3/20'}`}
              >
                {d.slice(0, 2)}
              </button>
            )
          })}
        </div>
      </Section>

      <div className="mb-1.5 px-8 text-[13px] uppercase tracking-wide text-label-2">Exercises</div>
      {items.map((item, i) => {
        const e = byId.get(item.exerciseId)
        if (!e) return null
        return (
          <section key={`${item.exerciseId}-${i}`} className="mx-4 mb-3 rounded-[12px] bg-card px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{e.name}</div>
                <div className="text-[12px] text-label-2">{e.muscle}</div>
              </div>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="h-8 w-8 rounded-full bg-label-3/20 disabled:opacity-30">↑</button>
              <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="h-8 w-8 rounded-full bg-label-3/20 disabled:opacity-30">↓</button>
              <button type="button" aria-label={`Remove ${e.name}`} onClick={() => { setItems(items.filter((_, j) => j !== i)); setDirty(true) }} className="h-8 w-8 rounded-full bg-bad/15 text-bad">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Sets" value={item.sets} onChange={(v) => setItem(i, { sets: v ?? 1 })} />
              {(e.kind === 'weight' || e.kind === 'reps') && (
                <NumberField label="Reps" value={item.reps} onChange={(v) => setItem(i, { reps: v })} />
              )}
              {e.kind === 'weight' && (
                <NumberField label="Start kg" decimal value={item.weightKg} format={kg} onChange={(v) => setItem(i, { weightKg: v })} />
              )}
              {e.kind === 'distance' && (
                <NumberField label="km" decimal value={item.distanceM == null ? null : item.distanceM / 1000} format={(v) => km((v ?? 0) * 1000)} onChange={(v) => setItem(i, { distanceM: v == null ? null : v * 1000 })} />
              )}
              {(e.kind === 'time' || e.kind === 'distance') && (
                <TextField label="Time" value={item.durationS ? formatDuration(item.durationS) : ''} placeholder="mm:ss" onChange={(t) => setItem(i, { durationS: parseDuration(t) })} />
              )}
              <TextField label="Rest" value={item.restS ? formatDuration(item.restS) : ''} placeholder="1:30" onChange={(t) => setItem(i, { restS: parseDuration(t) })} />
              {e.kind === 'weight' && (
                <NumberField label="Add kg" decimal value={item.incrementKg} format={kg} onChange={(v) => setItem(i, { incrementKg: v })} />
              )}
            </div>
            {e.kind === 'weight' && (
              <p className="mt-2 text-[12px] leading-snug text-label-2">
                “Add kg”: when every set reaches {item.reps ?? 'the target'} reps, the next workout suggests this much more.
              </p>
            )}
          </section>
        )
      })}
      <div className="mx-4 mb-8">
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent/12 py-3 font-semibold text-accent">
          <Plus size={20} /> Add exercise
        </button>
      </div>

      <Section title="Notes">
        <div className="px-4 py-3">
          <AutoTextarea value={notes} onChange={change(setNotes)} placeholder="Warm-up, cues, anything to remember" ariaLabel="Notes" />
        </div>
      </Section>

      {!isNew && (
        <Section>
          <ButtonRow onClick={startNow} disabled={Boolean(active) || items.length === 0}>
            {active ? 'Finish your current workout to start this one' : 'Start this routine now'}
          </ButtonRow>
          <ButtonRow tone="bad" onClick={remove}>
            Delete routine
          </ButtonRow>
        </Section>
      )}

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </Page>
  )
}

function NumberField({
  label,
  value,
  onChange,
  decimal,
  format = (v) => (v == null ? '' : String(v)),
}: {
  label: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  decimal?: boolean
  format?: (v: number | null) => string
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-label-2">{label}</span>
      <input
        key={String(value)}
        defaultValue={value == null ? '' : format(value)}
        inputMode={decimal ? 'decimal' : 'numeric'}
        onBlur={(e) => {
          const t = e.target.value.trim().replace(',', '.')
          const n = t === '' ? null : Number(t)
          const next = n === null || !Number.isFinite(n) ? null : n
          if (next !== (value ?? null)) onChange(next)
        }}
        className="mt-0.5 w-full rounded-[8px] bg-label-3/15 px-2 py-1.5 tabular-nums outline-none focus:bg-accent/15"
      />
    </label>
  )
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (t: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] text-label-2">{label}</span>
      <input
        key={value}
        defaultValue={value}
        placeholder={placeholder}
        inputMode="numeric"
        onBlur={(e) => e.target.value !== value && onChange(e.target.value)}
        className="mt-0.5 w-full rounded-[8px] bg-label-3/15 px-2 py-1.5 tabular-nums outline-none placeholder:text-label-3 focus:bg-accent/15"
      />
    </label>
  )
}
