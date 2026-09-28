import { useEffect, useRef, useState } from 'react'
import { act } from '../../app/data'
import { formatDay, formatTime } from '../../engine/dates'
import { parseQuickAdd } from '../../engine/quickadd'
import { describeRecurrence } from '../../engine/recurrence'
import type { TaskInput } from '../../engine/tasks'
import { Sheet } from '../../ui/Sheet'
import { showToast } from '../../ui/Toast'

/**
 * Quick add: type a task in plain words ("Call Ravi tomorrow 5pm #work p1").
 * Recognised dates, times, tags, priority and repeats show as chips before adding.
 */
export function QuickAddSheet({
  open,
  onClose,
  today,
  defaults,
  hint,
}: {
  open: boolean
  onClose: () => void
  today: string
  defaults?: TaskInput
  hint?: string
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setText('')
      // Moves focus from the keyboard primer to this input, keeping the keyboard up on iOS.
      input.current?.focus()
    }
  }, [open])

  const parsed = parseQuickAdd(text, today)
  const due = parsed.due ?? defaults?.due ?? null
  const chips: string[] = []
  if (due) chips.push(formatDay(due, today) + (parsed.time ? `, ${formatTime(parsed.time)}` : ''))
  if (parsed.recurrence) chips.push(describeRecurrence(parsed.recurrence, due))
  if (parsed.priority) chips.push(`P${parsed.priority}`)
  if (defaults?.project) chips.push(defaults.project)
  for (const t of [...(defaults?.tags ?? []), ...parsed.tags]) chips.push(`#${t}`)

  const add = async () => {
    if (!parsed.title || busy) return
    setBusy(true)
    const task = await act('quickAddTask', { text, today, defaults })
    setBusy(false)
    if (task) {
      setText('')
      showToast('Task added')
      input.current?.focus()
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New task"
      right={
        <button
          type="button"
          onClick={add}
          disabled={!parsed.title || busy}
          className="text-[17px] font-semibold text-accent disabled:opacity-30"
        >
          Add
        </button>
      }
    >
      <form
        className="px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Submit comments Fri 5pm #work p1"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="on"
          className="w-full rounded-[10px] bg-card px-4 py-3 outline-none placeholder:text-label-3"
          aria-label="Task"
        />
        <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-accent/15 px-2.5 py-1 text-[13px] font-medium text-accent">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-label-2">
          {hint ??
            'Dates: today, tomorrow, fri, next mon, 12 oct, 15/3, in 3 days. Times: 5pm, 17:30. Repeat: every day, every mon and thu. Also #tag and p1–p4.'}
        </p>
      </form>
    </Sheet>
  )
}
