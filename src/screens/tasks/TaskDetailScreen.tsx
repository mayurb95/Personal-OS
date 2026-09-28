import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { addDays, formatDay, startOfWeek, weekday } from '../../engine/dates'
import { describeRecurrence, firstOccurrence, type Recurrence } from '../../engine/recurrence'
import type { Priority, Task, TaskInput } from '../../engine/tasks'
import { AutoTextarea, CheckCircle, inputClass, Toggle } from '../../ui/Controls'
import { Flag, Trash } from '../../ui/Icons'
import { ButtonRow, Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { showToast } from '../../ui/Toast'
import { priorityTone } from './TaskRow'

type RepeatPreset = 'none' | 'day' | 'weekday' | 'week' | '2week' | 'month' | 'year' | 'after' | 'custom'

function presetOf(r: Recurrence | null): RepeatPreset {
  if (!r) return 'none'
  if (r.fromCompletion) return 'after'
  if (r.freq === 'day' && r.interval === 1) return 'day'
  if (r.freq === 'month' && r.interval === 1) return 'month'
  if (r.freq === 'month' && r.interval === 12) return 'year'
  if (r.freq === 'week' && !r.weekdays?.length) return r.interval === 1 ? 'week' : r.interval === 2 ? '2week' : 'custom'
  if (r.freq === 'week' && r.interval === 1 && r.weekdays?.join() === '0,1,2,3,4') return 'weekday'
  return 'custom'
}

function ruleFor(preset: RepeatPreset, afterDays: number): Recurrence | null {
  switch (preset) {
    case 'day':
      return { freq: 'day', interval: 1 }
    case 'weekday':
      return { freq: 'week', interval: 1, weekdays: [0, 1, 2, 3, 4] }
    case 'week':
      return { freq: 'week', interval: 1 }
    case '2week':
      return { freq: 'week', interval: 2 }
    case 'month':
      return { freq: 'month', interval: 1 }
    case 'year':
      return { freq: 'month', interval: 12 }
    case 'after':
      return { freq: 'day', interval: Math.max(1, afterDays), fromCompletion: true }
    default:
      return null
  }
}

/** A task's details, edited in place like iOS Reminders; every change saves immediately. */
export function TaskDetailScreen() {
  const { id = '' } = useParams()
  const today = useToday()
  const navigate = useNavigate()
  const { data: task, error } = useDbQuery('getTask', { id })
  const projects = useDbQuery('listProjects').data ?? []
  const allTags = useDbQuery('listTaskTags').data ?? []
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setNotes(task.notes)
    }
  }, [task])

  if (error) {
    return (
      <Page>
        <NavBar back={{ to: '/tasks', label: 'Tasks' }} />
        <p className="p-8 text-center text-label-2">{error}</p>
      </Page>
    )
  }
  if (!task) return <NavBar back={{ to: '/tasks', label: 'Tasks' }} />

  const save = (patch: TaskInput) => act('updateTask', { id: task.id, ...patch })

  const saveText = () => {
    if (!title.trim()) {
      setTitle(task.title)
      return
    }
    if (title !== task.title || notes !== task.notes) void save({ title, notes })
  }

  const setDue = (due: string | null) => void save({ due })

  const preset = presetOf(task.recurrence)
  const setRepeat = (value: RepeatPreset) => {
    if (value === 'custom') return
    const rule = ruleFor(value, task.recurrence?.interval ?? 3)
    const due = rule && !task.due ? firstOccurrence(rule, today) : task.due
    void save({ recurrence: rule, due })
  }

  const addProject = () => {
    const name = window.prompt('New project name')
    if (name?.trim()) void save({ project: name.trim() })
  }

  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '')
    if (!tag) return
    if (!task.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) void save({ tags: [...task.tags, tag] })
    setNewTag('')
  }

  const remove = async () => {
    await act('trashRecord', { id: task.id })
    showToast('Moved to trash', 'info', {
      label: 'Undo',
      run: () => void act('restoreRecord', { id: task.id }),
    })
    navigate(-1)
  }

  const toggleDone = async () => {
    const result = await act('setTaskDone', { id: task.id, done: !task.done, today })
    if (result?.next) showToast(`Next: ${formatDay(result.next.due ?? today, today)}`)
  }

  return (
    <Page>
      <NavBar back={{ to: '/tasks', label: 'Tasks' }} title={task.done ? 'Completed' : ''} />
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-start gap-3 rounded-[10px] bg-card px-4 py-3">
          <div className="pt-1">
            <CheckCircle
              checked={task.done}
              onToggle={toggleDone}
              tone={priorityTone(task.priority)}
              label={task.done ? 'Mark not done' : 'Complete'}
            />
          </div>
          <div className="min-w-0 flex-1">
            <AutoTextarea
              value={title}
              onChange={setTitle}
              onBlur={saveText}
              ariaLabel="Title"
              className={`text-[20px] font-semibold ${task.done ? 'text-label-2 line-through' : ''}`}
            />
            <AutoTextarea
              value={notes}
              onChange={setNotes}
              onBlur={saveText}
              placeholder="Notes"
              ariaLabel="Notes"
              className="mt-1 text-[15px] text-label-2"
            />
          </div>
        </div>
      </div>

      <Section title="When">
        <Row
          label="Date"
          value={
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => setDue(e.target.value || null)}
              className={`${inputClass} ${task.due && task.due < today && !task.done ? 'text-bad' : ''}`}
              aria-label="Due date"
            />
          }
          detail={task.due ? formatDay(task.due, today) : undefined}
        />
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-b-[0.5px] border-separator px-4 py-2.5">
          {[
            ['Today', today],
            ['Tomorrow', addDays(today, 1)],
            ['Next week', addDays(startOfWeek(today), 7)],
          ].map(([label, date]) => (
            <button
              key={label}
              type="button"
              onClick={() => setDue(date!)}
              className={`rounded-full px-3 py-1 text-[13px] font-medium ${
                task.due === date ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
              }`}
            >
              {label}
            </button>
          ))}
          {task.due && (
            <button
              type="button"
              onClick={() => setDue(null)}
              className="rounded-full bg-label-3/30 px-3 py-1 text-[13px] font-medium"
            >
              No date
            </button>
          )}
        </div>
        {task.due && (
          <Row
            label="Time"
            value={
              <input
                type="time"
                value={task.time ?? ''}
                onChange={(e) => void save({ time: e.target.value || null })}
                className={inputClass}
                aria-label="Time"
              />
            }
          />
        )}
        <Row
          label="Repeat"
          value={
            <select
              value={preset}
              onChange={(e) => setRepeat(e.target.value as RepeatPreset)}
              className={`${inputClass} appearance-none`}
              aria-label="Repeat"
            >
              <option value="none">Never</option>
              <option value="day">Every day</option>
              <option value="weekday">Every weekday</option>
              <option value="week">Every week{task.due ? ` (${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday(task.due)]})` : ''}</option>
              <option value="2week">Every 2 weeks</option>
              <option value="month">Every month</option>
              <option value="year">Every year</option>
              <option value="after">Some days after completion</option>
              {preset === 'custom' && task.recurrence && (
                <option value="custom">{describeRecurrence(task.recurrence, task.due)}</option>
              )}
            </select>
          }
        />
        {preset === 'after' && task.recurrence && (
          <Row
            label="Days after completion"
            value={
              <input
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={task.recurrence.interval}
                onBlur={(e) => void save({ recurrence: ruleFor('after', Number(e.target.value) || 1) })}
                className={`${inputClass} w-16`}
                aria-label="Days after completion"
              />
            }
          />
        )}
        {!task.due && (
          <Row label="Someday" action={<Toggle checked={task.someday} onChange={(v) => void save({ someday: v })} label="Someday" />} />
        )}
      </Section>

      <Section title="Details">
        <Row
          label="Priority"
          action={
            <div className="flex gap-1.5">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={task.priority === p}
                  onClick={() => void save({ priority: task.priority === p ? null : p })}
                  className={`flex h-8 items-center gap-0.5 rounded-full px-2 text-[13px] font-semibold ${
                    task.priority === p ? `${toneBg(p)} text-white` : 'bg-label-3/25 text-label-2'
                  }`}
                >
                  <Flag size={13} className={task.priority === p ? '' : toneText(p)} />P{p}
                </button>
              ))}
            </div>
          }
        />
        <Row
          label="Project"
          value={
            <select
              value={task.project ?? ''}
              onChange={(e) => {
                if (e.target.value === '__new') addProject()
                else void save({ project: e.target.value || null })
              }}
              className={`${inputClass} appearance-none`}
              aria-label="Project"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="__new">New project…</option>
            </select>
          }
        />
        <div className="border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {task.tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => void save({ tags: task.tags.filter((x) => x !== t) })}
                className="rounded-full bg-accent/15 px-2.5 py-1 text-[13px] font-medium text-accent"
                aria-label={`Remove tag ${t}`}
              >
                #{t} ×
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addTag()
            }}
            className="flex items-center gap-2"
          >
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onBlur={addTag}
              list="task-tags"
              placeholder="Add tag"
              enterKeyHint="done"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-3"
              aria-label="Add tag"
            />
            <datalist id="task-tags">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </form>
        </div>
      </Section>

      <Section>
        <ButtonRow tone="bad" onClick={remove}>
          <span className="flex items-center gap-2">
            <Trash size={18} /> Delete task
          </span>
        </ButtonRow>
      </Section>
      <p className="px-8 text-center text-[13px] text-label-3">
        Created {new Date(task.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        {task.completedAt
          ? ` · Completed ${new Date(task.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
          : ''}
      </p>
    </Page>
  )
}

function toneBg(p: Task['priority']): string {
  const tone = priorityTone(p)
  return tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : tone === 'accent' ? 'bg-accent' : 'bg-label-2'
}

function toneText(p: Task['priority']): string {
  const tone = priorityTone(p)
  return tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : ''
}
