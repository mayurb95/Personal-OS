import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { WEEKDAY_SHORT, weekday } from '../../engine/dates'
import type { HabitKind, HabitSchedule, PartOfDay } from '../../engine/habits'
import { AutoTextarea, inputClass, Segmented } from '../../ui/Controls'
import { Row, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { KIND_LABELS } from './HabitRow'

type ScheduleType = HabitSchedule['type']

interface Form {
  name: string
  kind: HabitKind
  target: string
  unit: string
  scheduleType: ScheduleType
  days: number[]
  times: string
  every: string
  partOfDay: PartOfDay
  notes: string
}

const BLANK: Form = {
  name: '',
  kind: 'check',
  target: '1',
  unit: '',
  scheduleType: 'daily',
  days: [0, 1, 2, 3, 4],
  times: '3',
  every: '2',
  partOfDay: 'anytime',
  notes: '',
}

const UNIT_HINT: Partial<Record<HabitKind, string>> = {
  count: 'glasses, pages, reps',
  measure: 'h, kg, km, ₹',
  limit: 'cups, times',
}

export function HabitEditScreen() {
  const { id } = useParams()
  const isNew = !id
  const today = useToday()
  const navigate = useNavigate()
  const existing = useDbQuery('getHabit', { id: id ?? '' })
  const [form, setForm] = useState<Form>(BLANK)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const h = existing.data
    if (isNew || !h) return
    setForm({
      name: h.name,
      kind: h.kind,
      target: String(h.target),
      unit: h.unit,
      scheduleType: h.schedule.type,
      days: h.schedule.type === 'weekdays' ? h.schedule.days : BLANK.days,
      times: h.schedule.type === 'weekly' ? String(h.schedule.times) : BLANK.times,
      every: h.schedule.type === 'interval' ? String(h.schedule.every) : BLANK.every,
      partOfDay: h.partOfDay,
      notes: h.notes,
    })
  }, [existing.data, isNew])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const schedule = (): HabitSchedule => {
    switch (form.scheduleType) {
      case 'weekdays':
        return { type: 'weekdays', days: form.days.length ? form.days : [weekday(today)] }
      case 'weekly':
        return { type: 'weekly', times: Math.min(7, Math.max(1, Number(form.times) || 1)) }
      case 'interval':
        return {
          type: 'interval',
          every: Math.max(2, Number(form.every) || 2),
          start:
            existing.data?.schedule.type === 'interval' ? existing.data.schedule.start : today,
        }
      default:
        return { type: 'daily' }
    }
  }

  const needsTarget = form.kind === 'count' || form.kind === 'measure' || form.kind === 'duration' || form.kind === 'limit'

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const target = needsTarget ? Math.max(0, Number(form.target.replace(',', '.')) || 0) : 1
    const payload = {
      name: form.name,
      kind: form.kind,
      target: form.kind === 'limit' ? target : Math.max(target, needsTarget ? 0.1 : 1),
      unit: form.kind === 'duration' ? '' : form.unit,
      schedule: schedule(),
      partOfDay: form.partOfDay,
      notes: form.notes,
    }
    const result = isNew
      ? await act('createHabit', payload)
      : await act('updateHabit', { id: id!, ...payload })
    setSaving(false)
    if (result) navigate(isNew ? `/habits/${result.id}` : `/habits/${id}`, { replace: true })
  }

  return (
    <Page>
      <NavBar
        back={{ to: isNew ? '/habits' : `/habits/${id}`, label: isNew ? 'Habits' : 'Back' }}
        title={isNew ? 'New habit' : 'Edit habit'}
        right={
          <BarButton bold onClick={save} disabled={!form.name.trim() || saving}>
            Save
          </BarButton>
        }
      />
      <div className="pt-4" />
      <Section>
        <div className="px-4 py-3">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Name, e.g. Meditate"
            autoFocus={isNew}
            className="w-full bg-transparent text-[20px] font-semibold outline-none placeholder:text-label-3"
            aria-label="Name"
          />
        </div>
      </Section>

      <Section title="What to track">
        <Row
          label="Type"
          value={
            <select
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as HabitKind
                setForm((f) => ({ ...f, kind, target: kind === 'limit' ? '0' : kind === 'duration' ? '30' : f.target === '0' ? '1' : f.target }))
              }}
              className={`${inputClass} appearance-none`}
              aria-label="Type"
            >
              {(Object.keys(KIND_LABELS) as HabitKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          }
        />
        {needsTarget && (
          <Row
            label={form.kind === 'limit' ? 'At most, per day' : form.kind === 'duration' ? 'Minutes per day' : 'Daily target'}
            value={
              <input
                value={form.target}
                onChange={(e) => set('target', e.target.value)}
                inputMode="decimal"
                className={`${inputClass} w-24`}
                aria-label="Target"
              />
            }
          />
        )}
        {needsTarget && form.kind !== 'duration' && (
          <Row
            label="Unit"
            value={
              <input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder={UNIT_HINT[form.kind] ?? ''}
                className={inputClass}
                aria-label="Unit"
              />
            }
          />
        )}
      </Section>

      <Section title="How often">
        <div className="border-b-[0.5px] border-separator px-4 py-2.5">
          <Segmented<ScheduleType>
            label="Schedule"
            value={form.scheduleType}
            onChange={(v) => set('scheduleType', v)}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekdays', label: 'Days' },
              { value: 'weekly', label: 'Per week' },
              { value: 'interval', label: 'Every N' },
            ]}
          />
        </div>
        {form.scheduleType === 'weekdays' && (
          <div className="flex justify-between gap-1 px-4 py-3">
            {WEEKDAY_SHORT.map((d, i) => {
              const on = form.days.includes(i)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('days', on ? form.days.filter((x) => x !== i) : [...form.days, i].sort())}
                  className={`h-10 flex-1 rounded-full text-[13px] font-semibold ${on ? 'bg-accent text-white' : 'bg-label-3/20'}`}
                >
                  {d.slice(0, 2)}
                </button>
              )
            })}
          </div>
        )}
        {form.scheduleType === 'weekly' && (
          <Row
            label="Times a week"
            value={
              <input value={form.times} onChange={(e) => set('times', e.target.value)} inputMode="numeric" className={`${inputClass} w-16`} aria-label="Times a week" />
            }
          />
        )}
        {form.scheduleType === 'interval' && (
          <Row
            label="Every how many days"
            value={
              <input value={form.every} onChange={(e) => set('every', e.target.value)} inputMode="numeric" className={`${inputClass} w-16`} aria-label="Every how many days" />
            }
          />
        )}
        <div className="px-4 py-2.5">
          <div className="mb-1.5 text-[13px] text-label-2">Time of day</div>
          <Segmented<PartOfDay>
            label="Time of day"
            value={form.partOfDay}
            onChange={(v) => set('partOfDay', v)}
            options={[
              { value: 'morning', label: 'Morning' },
              { value: 'anytime', label: 'Anytime' },
              { value: 'evening', label: 'Evening' },
            ]}
          />
        </div>
      </Section>

      <Section title="Notes">
        <div className="px-4 py-3">
          <AutoTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Why this habit matters, how to do it" ariaLabel="Notes" />
        </div>
      </Section>
    </Page>
  )
}
