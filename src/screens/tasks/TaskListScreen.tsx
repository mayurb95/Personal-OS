import { useState } from 'react'
import { useParams } from 'react-router'
import { useDbQuery, useToday } from '../../app/data'
import { formatDay, formatDayWithWeekday } from '../../engine/dates'
import type { Task, TaskInput, TaskList } from '../../engine/tasks'
import { EmptyState, FloatingAdd } from '../../ui/Controls'
import { Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { primeKeyboard } from '../../ui/Sheet'
import { QuickAddSheet } from './QuickAddSheet'
import { TaskRow } from './TaskRow'

const TITLES: Record<string, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  inbox: 'Inbox',
  someday: 'Someday',
  all: 'All open tasks',
  done: 'Completed',
}

const EMPTY: Record<string, [string, string]> = {
  today: ['Nothing due today', 'Tasks due today or overdue show up here.'],
  upcoming: ['Nothing coming up', 'Tasks with a future date show up here.'],
  inbox: ['Inbox is clear', 'New tasks without a date or project land here.'],
  someday: ['No someday tasks', 'Mark a task “Someday” to park it here.'],
  all: ['No open tasks', 'Tap + to add one.'],
  done: ['Nothing completed yet', 'Tasks you tick off in the last 30 days show up here.'],
  project: ['No open tasks in this project', 'Tap + to add one.'],
  tag: ['No open tasks with this tag', 'Tap + to add one.'],
}

/** One task list: a built-in list, a project or a tag. Upcoming is grouped by day. */
export function TaskListScreen({ kind }: { kind: 'list' | 'project' | 'tag' }) {
  const params = useParams()
  const today = useToday()
  const [adding, setAdding] = useState(false)
  const list: TaskList = kind === 'list' ? ((params.list as TaskList) ?? 'all') : kind
  const name = kind === 'project' ? params.name ?? '' : kind === 'tag' ? params.tag ?? '' : ''
  const { data: tasks } = useDbQuery('listTasks', {
    list,
    today,
    project: kind === 'project' ? name : undefined,
    tag: kind === 'tag' ? name : undefined,
  })

  const title = kind === 'project' ? name : kind === 'tag' ? `#${name}` : TITLES[list] ?? 'Tasks'
  const defaults: TaskInput | undefined =
    kind === 'project'
      ? { project: name }
      : kind === 'tag'
        ? { tags: [name] }
        : list === 'today'
          ? { due: today }
          : list === 'someday'
            ? { someday: true }
            : undefined

  const groups = groupTasks(tasks ?? [], list, today)
  const [emptyTitle, emptyText] = EMPTY[list] ?? EMPTY.all!

  return (
    <Page>
      <NavBar title={title} back={{ to: '/tasks', label: 'Tasks' }} />
      <div className="pt-4">
        {tasks && tasks.length === 0 && <EmptyState title={emptyTitle}>{emptyText}</EmptyState>}
        {groups.map((g) => (
          <Section key={g.key} title={g.title}>
            {g.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                today={today}
                showDue={g.showDue}
                showProject={kind !== 'project'}
              />
            ))}
          </Section>
        ))}
      </div>
      {list !== 'done' && (
        <FloatingAdd
          label="New task"
          onClick={() => {
            primeKeyboard()
            setAdding(true)
          }}
        />
      )}
      <QuickAddSheet open={adding} onClose={() => setAdding(false)} today={today} defaults={defaults} />
    </Page>
  )
}

interface Group {
  key: string
  title?: string
  tasks: Task[]
  showDue: boolean
}

function groupTasks(tasks: Task[], list: TaskList, today: string): Group[] {
  if (list === 'today') {
    const overdue = tasks.filter((t) => t.due! < today)
    const due = tasks.filter((t) => t.due === today)
    return [
      ...(overdue.length ? [{ key: 'overdue', title: 'Overdue', tasks: overdue, showDue: true }] : []),
      ...(due.length ? [{ key: 'today', title: overdue.length ? 'Today' : undefined, tasks: due, showDue: false }] : []),
    ]
  }
  if (list === 'upcoming') {
    const byDay = new Map<string, Task[]>()
    for (const t of tasks) byDay.set(t.due!, [...(byDay.get(t.due!) ?? []), t])
    return [...byDay].map(([day, ts]) => ({
      key: day,
      title: formatDay(day, today) === 'Tomorrow' ? `Tomorrow · ${formatDayWithWeekday(day)}` : formatDayWithWeekday(day),
      tasks: ts,
      showDue: false,
    }))
  }
  if (list === 'done') {
    return tasks.length ? [{ key: 'done', tasks, showDue: true }] : []
  }
  return tasks.length ? [{ key: 'all', tasks, showDue: true }] : []
}
