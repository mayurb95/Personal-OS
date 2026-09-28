import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { act } from '../../app/data'
import { formatDay, formatTime } from '../../engine/dates'
import type { Task } from '../../engine/tasks'
import { CheckCircle } from '../../ui/Controls'
import { Folder, Repeat } from '../../ui/Icons'
import { showToast } from '../../ui/Toast'

export function priorityTone(p: Task['priority']): 'bad' | 'warn' | 'accent' | 'neutral' {
  return p === 1 ? 'bad' : p === 2 ? 'warn' : p === 3 ? 'accent' : 'neutral'
}

/** One task in a list: tick box, title and a line of details. Tapping opens the task. */
export function TaskRow({
  task,
  today,
  showDue = true,
  showProject = true,
}: {
  task: Task
  today: string
  showDue?: boolean
  showProject?: boolean
}) {
  const [pending, setPending] = useState<boolean | null>(null)
  const timer = useRef<number | null>(null)
  const checked = pending ?? task.done

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const toggle = () => {
    const next = !checked
    setPending(next)
    if (timer.current) window.clearTimeout(timer.current)
    // A short pause shows the tick before the task leaves the list; tapping again cancels.
    timer.current = window.setTimeout(async () => {
      timer.current = null
      if (next === task.done) {
        setPending(null)
        return
      }
      const result = await act('setTaskDone', { id: task.id, done: next, today })
      setPending(null)
      if (result?.next) showToast(`Next: ${formatDay(result.next.due ?? today, today)}`)
    }, 450)
  }

  const overdue = !task.done && task.due !== null && task.due < today
  const meta: React.ReactNode[] = []
  if (showDue && task.due) {
    meta.push(
      <span key="due" className={overdue ? 'text-bad' : ''}>
        {formatDay(task.due, today)}
        {task.time ? `, ${formatTime(task.time)}` : ''}
      </span>,
    )
  } else if (task.time) {
    meta.push(<span key="time">{formatTime(task.time)}</span>)
  }
  if (task.recurrence) meta.push(<Repeat key="rep" size={13} className="inline" />)
  if (showProject && task.project) {
    meta.push(
      <span key="proj" className="inline-flex items-center gap-0.5">
        <Folder size={13} /> {task.project}
      </span>,
    )
  }
  for (const tag of task.tags) meta.push(<span key={`t-${tag}`}>#{tag}</span>)

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="flex items-start gap-3 border-b-[0.5px] border-separator py-2.5 pl-4 pr-4 last:border-b-0 active:bg-card-pressed"
    >
      <div className="pt-0.5">
        <CheckCircle
          checked={checked}
          onToggle={toggle}
          tone={priorityTone(task.priority)}
          label={checked ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`leading-snug ${checked ? 'text-label-2 line-through' : ''}`}>{task.title}</div>
        {meta.length > 0 && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-label-2">
            {meta}
          </div>
        )}
      </div>
    </Link>
  )
}
