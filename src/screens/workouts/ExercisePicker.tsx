import { useEffect, useMemo, useState } from 'react'
import { act, useDbQuery } from '../../app/data'
import { MUSCLES } from '../../engine/seed'
import type { Exercise, ExerciseKind } from '../../engine/workouts'
import { Segmented } from '../../ui/Controls'
import { SearchIcon } from '../../ui/Icons'
import { Sheet } from '../../ui/Sheet'
import { KIND_LABEL } from './format'

/** Choose an exercise (searchable, grouped by muscle), or create a new one. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  exclude = [],
}: {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  exclude?: string[]
}) {
  const { data } = useDbQuery('listExercises')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weight')
  const [muscle, setMuscle] = useState<string>('Chest')

  useEffect(() => {
    if (open) {
      setQuery('')
      setCreating(false)
    }
  }, [open])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (data ?? []).filter(
      (e) => !exclude.includes(e.id) && (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)),
    )
    const recent = q ? [] : [...list].filter((e) => e.lastDone).sort((a, b) => b.lastDone!.localeCompare(a.lastDone!)).slice(0, 5)
    const byMuscle = new Map<string, Exercise[]>()
    for (const e of list) byMuscle.set(e.muscle || 'Other', [...(byMuscle.get(e.muscle || 'Other') ?? []), e])
    const order = [...MUSCLES, 'Other'] as string[]
    return [
      ...(recent.length ? [['Recent', recent] as const] : []),
      ...[...byMuscle.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])),
    ]
  }, [data, query, exclude])

  const create = async () => {
    const e = await act('createExercise', { name, kind, muscle })
    if (e) {
      setName('')
      onPick(e)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={creating ? 'New exercise' : 'Add exercise'}
      right={
        creating ? (
          <button type="button" onClick={create} disabled={!name.trim()} className="text-[17px] font-semibold text-accent disabled:opacity-30">
            Add
          </button>
        ) : (
          <button type="button" onClick={() => { setName(query); setCreating(true) }} className="text-[17px] text-accent">
            New
          </button>
        )
      }
    >
      {creating ? (
        <div className="space-y-3 px-4 pb-6">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Incline curl"
            className="w-full rounded-[10px] bg-card px-4 py-3 outline-none placeholder:text-label-3"
            aria-label="Exercise name"
          />
          <div>
            <div className="mb-1.5 px-1 text-[13px] text-label-2">What to log</div>
            <Segmented<ExerciseKind>
              label="What to log"
              value={kind}
              onChange={setKind}
              options={(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => ({
                value: k,
                label: k === 'weight' ? 'kg × reps' : k === 'reps' ? 'Reps' : k === 'time' ? 'Time' : 'Distance',
              }))}
            />
          </div>
          <div>
            <div className="mb-1.5 px-1 text-[13px] text-label-2">Muscle group</div>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuscle(m)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${muscle === m ? 'bg-accent text-white' : 'bg-card'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-4">
          <div className="px-4 pb-3">
            <label className="flex items-center gap-2 rounded-[10px] bg-label-3/20 px-3 py-2">
              <SearchIcon size={18} className="text-label-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
                aria-label="Search exercises"
              />
            </label>
          </div>
          {groups.map(([title, list]) => (
            <div key={title} className="mx-4 mb-4">
              <div className="mb-1 px-4 text-[13px] uppercase tracking-wide text-label-2">{title}</div>
              <div className="overflow-hidden rounded-[10px] bg-card">
                {list.map((e) => (
                  <button
                    key={`${title}-${e.id}`}
                    type="button"
                    onClick={() => onPick(e)}
                    className="flex w-full items-center justify-between border-b-[0.5px] border-separator px-4 py-2.5 text-left last:border-b-0 active:bg-card-pressed"
                  >
                    <span>{e.name}</span>
                    <span className="text-[13px] text-label-2">{e.equipment !== 'None' ? e.equipment : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <button type="button" onClick={() => { setName(query); setCreating(true) }} className="mx-4 block text-accent">
              Create “{query}”
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
