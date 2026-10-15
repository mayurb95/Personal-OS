import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { act, useDbQuery } from '../../app/data'
import { formatDay } from '../../engine/dates'
import { formatDuration, parseDuration, type PreviousSet, type Session, type SessionExercise, type WorkoutSet } from '../../engine/workouts'
import { AutoTextarea } from '../../ui/Controls'
import { Check, Ellipsis, Plus } from '../../ui/Icons'
import { ButtonRow, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { showToast } from '../../ui/Toast'
import { ExercisePicker } from './ExercisePicker'
import { kg, km, minutes, volume } from './format'
import { adjustRest, startRest, stopRest, useRestTimer, useWakeLock } from './restTimer'

/** A workout: live logging while it's running, a summary once finished. */
export function SessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: session, error } = useDbQuery('getSession', { id })
  const [picking, setPicking] = useState(false)
  const [menuFor, setMenuFor] = useState<SessionExercise | null>(null)
  const [notes, setNotes] = useState('')
  const live = session ? !session.endedAt : false
  useWakeLock(live)

  useEffect(() => {
    if (session) setNotes(session.notes)
  }, [session])

  if (error) {
    return (
      <Page>
        <NavBar back={{ to: '/workouts', label: 'Workouts' }} />
        <p className="p-8 text-center text-label-2">{error}</p>
      </Page>
    )
  }
  if (!session) return <NavBar back={{ to: '/workouts', label: 'Workouts' }} />

  const finish = async () => {
    const done = await act('finishSession', { id })
    if (done) {
      stopRest()
      showToast(done.prs.length ? `Workout saved · ${done.prs.length} new record${done.prs.length > 1 ? 's' : ''}` : 'Workout saved')
    }
  }

  const discard = async () => {
    if (!window.confirm(live ? 'Discard this workout? Nothing from it will be saved.' : 'Delete this workout from your history?')) return
    await act('deleteSession', { id })
    stopRest()
    navigate('/workouts', { replace: true })
  }

  const rename = async () => {
    const name = window.prompt('Workout name', session.name)
    if (name?.trim()) await act('updateSession', { id, name })
  }

  return (
    <Page>
      <NavBar
        back={{ to: '/workouts', label: 'Workouts' }}
        title={live ? <Elapsed startedAt={session.startedAt} /> : session.name}
        right={
          live ? (
            <BarButton bold onClick={finish}>
              Finish
            </BarButton>
          ) : undefined
        }
      />
      <div className="px-4 pb-4 pt-4">
        <button type="button" onClick={rename} className="text-left text-[28px] font-bold leading-tight active:opacity-60">
          {session.name}
        </button>
        <div className="mt-0.5 text-[15px] text-label-2">
          {formatDay(session.day, session.day)} ·{' '}
          {new Date(session.startedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
          {session.endedAt ? ` · ${minutes(session.durationS)}` : ''}
        </div>
      </div>

      {!live && <Summary session={session} />}

      {session.items.map((item, i) => (
        <ExerciseBlock
          key={item.exercise.id}
          item={item}
          sessionId={id}
          live={live}
          isLast={i === session.items.length - 1}
          onMenu={() => setMenuFor(item)}
        />
      ))}

      {session.items.length === 0 && (
        <p className="px-8 pb-6 text-center text-[15px] text-label-2">Add your first exercise to start logging sets.</p>
      )}

      <div className="mx-4 mb-8">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent/12 py-3 font-semibold text-accent active:opacity-70"
        >
          <Plus size={20} /> Add exercise
        </button>
      </div>

      <Section title="Notes">
        <div className="px-4 py-3">
          <AutoTextarea
            value={notes}
            onChange={setNotes}
            onBlur={() => notes !== session.notes && void act('updateSession', { id, notes })}
            placeholder="How did it feel? Anything to change next time?"
            ariaLabel="Workout notes"
          />
        </div>
      </Section>

      <Section>
        {live && session.items.some((i) => i.sets.some((s) => s.done)) && (
          <ButtonRow onClick={finish}>Finish workout</ButtonRow>
        )}
        <ButtonRow tone="bad" onClick={discard}>
          {live ? 'Discard workout' : 'Delete workout'}
        </ButtonRow>
      </Section>

      {live && <RestBar />}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        exclude={session.items.map((i) => i.exercise.id)}
        onPick={async (e) => {
          setPicking(false)
          await act('addExerciseToSession', { sessionId: id, exerciseId: e.id })
        }}
      />

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.exercise.name}>
        {menuFor && (
          <div className="px-4 pb-2">
            <div className="overflow-hidden rounded-[10px] bg-card">
              <ButtonRow onClick={() => navigate(`/workouts/exercises/${menuFor.exercise.id}`)}>History and records</ButtonRow>
              <ButtonRow
                onClick={() => {
                  void act('moveExerciseInSession', { sessionId: id, exerciseId: menuFor.exercise.id, direction: 'up' })
                  setMenuFor(null)
                }}
              >
                Move up
              </ButtonRow>
              <ButtonRow
                onClick={() => {
                  void act('moveExerciseInSession', { sessionId: id, exerciseId: menuFor.exercise.id, direction: 'down' })
                  setMenuFor(null)
                }}
              >
                Move down
              </ButtonRow>
              <ButtonRow
                tone="bad"
                onClick={() => {
                  void act('removeExerciseFromSession', { sessionId: id, exerciseId: menuFor.exercise.id })
                  setMenuFor(null)
                }}
              >
                Remove from workout
              </ButtonRow>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return <span className="tabular-nums">{formatDuration((now - new Date(startedAt).getTime()) / 1000)}</span>
}

function Summary({ session }: { session: Session }) {
  const tiles = [
    ['Time', minutes(session.durationS)],
    ['Sets', String(session.sets)],
    ...(session.volumeKg ? [['Volume', volume(session.volumeKg)]] : []),
    ...(session.distanceM ? [['Distance', `${km(session.distanceM)} km`]] : []),
  ]
  return (
    <>
      <div className="mx-4 mb-6 grid grid-cols-2 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-[12px] bg-card p-3">
            <div className="text-[22px] font-bold leading-none">{value}</div>
            <div className="mt-1.5 text-[12px] text-label-2">{label}</div>
          </div>
        ))}
      </div>
      {session.prs.length > 0 && (
        <Section title="New records">
          {session.prs.map((p) => (
            <div key={p.setId} className="flex items-center gap-3 border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0">
              <span aria-hidden="true">🏆</span>
              <div>
                <div>{p.exerciseName}</div>
                <div className="text-[13px] text-label-2">{p.label}</div>
              </div>
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function columns(kind: SessionExercise['exercise']['kind']): string[] {
  switch (kind) {
    case 'weight':
      return ['kg', 'Reps']
    case 'reps':
      return ['Reps']
    case 'time':
      return ['Time']
    default:
      return ['km', 'Time']
  }
}

function prevText(kind: SessionExercise['exercise']['kind'], p: PreviousSet | undefined): string {
  if (!p) return '—'
  switch (kind) {
    case 'weight':
      return `${kg(p.weightKg) || 0} × ${p.reps ?? 0}`
    case 'reps':
      return `${p.reps ?? 0}`
    case 'time':
      return p.durationS ? formatDuration(p.durationS) : '—'
    default:
      return `${km(p.distanceM) || 0} km${p.durationS ? ` · ${formatDuration(p.durationS)}` : ''}`
  }
}

function ExerciseBlock({
  item,
  sessionId,
  live,
  isLast,
  onMenu,
}: {
  item: SessionExercise
  sessionId: string
  live: boolean
  isLast: boolean
  onMenu: () => void
}) {
  const kind = item.exercise.kind
  const cols = columns(kind)
  const grid = cols.length === 2 ? 'grid-cols-[2rem_1fr_4.5rem_4.5rem_2.75rem]' : 'grid-cols-[2rem_1fr_6rem_2.75rem]'
  return (
    <section className="mx-4 mb-6 overflow-hidden rounded-[12px] bg-card">
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <Link to={`/workouts/exercises/${item.exercise.id}`} className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold text-accent">{item.exercise.name}</div>
          <div className="text-[12px] text-label-2">
            {item.exercise.muscle}
            {item.sets[0]?.targetReps ? ` · target ${item.sets[0].targetReps} reps` : ''}
          </div>
        </Link>
        <button type="button" onClick={onMenu} aria-label={`Options for ${item.exercise.name}`} className="p-2 text-accent">
          <Ellipsis size={22} />
        </button>
      </div>
      <div className={`grid ${grid} items-center gap-2 px-3 pb-1 text-[12px] font-medium uppercase text-label-2`}>
        <span className="text-center">Set</span>
        <span>Previous</span>
        {cols.map((c) => (
          <span key={c} className="text-center">
            {c}
          </span>
        ))}
        <span className="text-center">{live ? '✓' : ''}</span>
      </div>
      {item.sets.map((set, i) => (
        <SetRow
          key={set.id}
          set={set}
          index={i}
          kind={kind}
          grid={grid}
          previous={item.previous[i] ?? item.previous.at(-1)}
          isPR={item.prSetIds.includes(set.id)}
          live={live}
          restLabel={isLast && i === item.sets.length - 1 ? 'Rest' : `Rest · next: ${item.exercise.name}`}
        />
      ))}
      <button
        type="button"
        onClick={() => void act('addSet', { sessionId, exerciseId: item.exercise.id })}
        className="flex w-full items-center justify-center gap-1 border-t-[0.5px] border-separator py-2.5 text-[15px] text-accent active:bg-card-pressed"
      >
        <Plus size={16} /> Add set
      </button>
    </section>
  )
}

function SetRow({
  set,
  index,
  kind,
  grid,
  previous,
  isPR,
  live,
  restLabel,
}: {
  set: WorkoutSet
  index: number
  kind: SessionExercise['exercise']['kind']
  grid: string
  previous: PreviousSet | undefined
  isPR: boolean
  live: boolean
  restLabel: string
}) {
  const save = (patch: Parameters<typeof act<'updateSet'>>[1]) => act('updateSet', patch)
  const num = (text: string) => {
    const t = text.trim().replace(',', '.')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  const toggle = () => {
    const done = !set.done
    // Empty fields take last time's values, so ticking a set is one tap.
    const patch: Parameters<typeof save>[0] = { id: set.id, done }
    if (done) {
      if (set.weightKg === null && previous?.weightKg != null) patch.weightKg = previous.weightKg
      if (set.reps === null && previous?.reps != null) patch.reps = previous.reps
      if (set.durationS === null && previous?.durationS != null) patch.durationS = previous.durationS
      if (set.distanceM === null && previous?.distanceM != null) patch.distanceM = previous.distanceM
      startRest(set.restS, restLabel)
    }
    void save(patch)
  }

  const input = 'w-full rounded-[8px] bg-label-3/15 px-1 py-1.5 text-center tabular-nums outline-none focus:bg-accent/15'
  const fields: React.ReactNode[] = []
  if (kind === 'weight') {
    fields.push(
      <input key={`w${set.weightKg}`} defaultValue={kg(set.weightKg)} placeholder={kg(previous?.weightKg) || '0'} inputMode="decimal" aria-label={`Set ${index + 1} kg`}
        onBlur={(e) => num(e.target.value) !== set.weightKg && void save({ id: set.id, weightKg: num(e.target.value) })} className={input} />,
    )
  }
  if (kind === 'weight' || kind === 'reps') {
    fields.push(
      <input key={`r${set.reps}`} defaultValue={set.reps ?? ''} placeholder={String(previous?.reps ?? set.targetReps ?? 0)} inputMode="numeric" aria-label={`Set ${index + 1} reps`}
        onBlur={(e) => num(e.target.value) !== set.reps && void save({ id: set.id, reps: num(e.target.value) })} className={input} />,
    )
  }
  if (kind === 'distance') {
    fields.push(
      <input key={`d${set.distanceM}`} defaultValue={km(set.distanceM)} placeholder={km(previous?.distanceM) || '0'} inputMode="decimal" aria-label={`Set ${index + 1} kilometres`}
        onBlur={(e) => {
          const v = num(e.target.value)
          const m = v === null ? null : Math.round(v * 1000)
          if (m !== set.distanceM) void save({ id: set.id, distanceM: m })
        }} className={input} />,
    )
  }
  if (kind === 'time' || kind === 'distance') {
    fields.push(
      <input key={`t${set.durationS}`} defaultValue={set.durationS ? formatDuration(set.durationS) : ''} placeholder={previous?.durationS ? formatDuration(previous.durationS) : 'mm:ss'} inputMode="numeric" aria-label={`Set ${index + 1} time, minutes and seconds`}
        onBlur={(e) => {
          const v = parseDuration(e.target.value)
          if (v !== set.durationS) void save({ id: set.id, durationS: v })
        }} className={input} />,
    )
  }

  return (
    <div className={`grid ${grid} items-center gap-2 px-3 py-1.5 ${set.done && live ? 'bg-good/10' : ''}`}>
      <span className="text-center text-[15px] font-semibold text-label-2">{isPR ? '🏆' : index + 1}</span>
      <span className="truncate text-[13px] text-label-2">{prevText(kind, previous)}</span>
      {fields}
      {live ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={set.done}
          aria-label={`Set ${index + 1} done`}
          onClick={toggle}
          className={`mx-auto flex h-8 w-8 items-center justify-center rounded-[8px] ${set.done ? 'bg-good text-white' : 'bg-label-3/25 text-label-2'}`}
        >
          <Check size={18} />
        </button>
      ) : (
        <button type="button" aria-label={`Delete set ${index + 1}`} onClick={() => void act('deleteSet', { id: set.id })} className="mx-auto text-[18px] text-label-3">
          ×
        </button>
      )}
    </div>
  )
}

/** The rest countdown, floating above the tab bar. */
function RestBar() {
  const { left, total, label } = useRestTimer()
  if (left === null) return null
  const ratio = total ? left / total : 0
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+58px)] z-30 px-3">
      <div className="mx-auto max-w-md overflow-hidden rounded-[14px] bg-label text-bg shadow-xl">
        <div className="h-1 bg-accent transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[26px] font-bold leading-none tabular-nums">{formatDuration(left)}</div>
            <div className="mt-0.5 truncate text-[12px] opacity-70">{label}</div>
          </div>
          <button type="button" onClick={() => adjustRest(-15)} className="rounded-full bg-bg/15 px-3 py-1.5 text-[15px] font-semibold">
            −15
          </button>
          <button type="button" onClick={() => adjustRest(15)} className="rounded-full bg-bg/15 px-3 py-1.5 text-[15px] font-semibold">
            +15
          </button>
          <button type="button" onClick={stopRest} className="rounded-full bg-accent px-3 py-1.5 text-[15px] font-semibold text-white">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
