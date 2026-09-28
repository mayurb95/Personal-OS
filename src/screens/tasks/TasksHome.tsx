import { useState } from 'react'
import { Link } from 'react-router'
import { useDbQuery, useToday } from '../../app/data'
import { FloatingAdd } from '../../ui/Controls'
import { CalendarIcon, Check, Folder, Inbox, ListIcon, Moon, Sun, TagIcon } from '../../ui/Icons'
import { Row, Section } from '../../ui/List'
import { Screen } from '../../ui/Screen'
import { primeKeyboard } from '../../ui/Sheet'
import { QuickAddSheet } from './QuickAddSheet'

const tiles = [
  { list: 'today', label: 'Today', icon: Sun, colour: 'bg-accent', key: 'today' },
  { list: 'upcoming', label: 'Upcoming', icon: CalendarIcon, colour: 'bg-bad', key: 'upcoming' },
  { list: 'inbox', label: 'Inbox', icon: Inbox, colour: 'bg-warn', key: 'inbox' },
  { list: 'someday', label: 'Someday', icon: Moon, colour: 'bg-label-2', key: 'someday' },
] as const

export function TasksHome() {
  const today = useToday()
  const counts = useDbQuery('taskCounts', { today }).data
  const projects = useDbQuery('listProjects').data ?? []
  const tags = useDbQuery('listTaskTags').data ?? []
  const [adding, setAdding] = useState(false)

  return (
    <Screen title="Tasks">
      <div className="mx-4 mb-8 grid grid-cols-2 gap-3">
        {tiles.map(({ list, label, icon: Icon, colour, key }) => (
          <Link
            key={list}
            to={`/tasks/list/${list}`}
            className="rounded-[12px] bg-card p-3 active:bg-card-pressed"
          >
            <div className="flex items-start justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${colour}`}>
                <Icon size={18} />
              </span>
              <span className="text-[26px] font-bold leading-none">{counts?.[key] ?? ''}</span>
            </div>
            <div className="mt-2 font-semibold text-label-2">
              {label}
              {key === 'today' && counts && counts.overdue > 0 && (
                <span className="ml-1 text-[13px] font-normal text-bad">· {counts.overdue} overdue</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Section title="Projects" footer={projects.length ? undefined : 'Set a project on a task and it appears here.'}>
        {projects.map((p) => (
          <Link key={p.name} to={`/tasks/project/${encodeURIComponent(p.name)}`} className="block">
            <Row label={<span className="flex items-center gap-2"><Folder size={18} className="text-accent" />{p.name}</span>} value={p.open || ''} />
          </Link>
        ))}
        {projects.length === 0 && <Row label="No projects yet" />}
      </Section>

      {tags.length > 0 && (
        <Section title="Tags">
          {tags.map((t) => (
            <Link key={t} to={`/tasks/tag/${encodeURIComponent(t)}`} className="block">
              <Row label={<span className="flex items-center gap-2"><TagIcon size={18} className="text-accent" />{t}</span>} />
            </Link>
          ))}
        </Section>
      )}

      <Section>
        <Link to="/tasks/list/all" className="block">
          <Row label={<span className="flex items-center gap-2"><ListIcon size={18} className="text-accent" />All open tasks</span>} value={counts?.all ?? ''} />
        </Link>
        <Link to="/tasks/list/done" className="block">
          <Row label={<span className="flex items-center gap-2"><Check size={18} className="text-good" />Completed</span>} detail="Last 30 days" />
        </Link>
      </Section>

      <FloatingAdd
        label="New task"
        onClick={() => {
          primeKeyboard()
          setAdding(true)
        }}
      />
      <QuickAddSheet open={adding} onClose={() => setAdding(false)} today={today} />
    </Screen>
  )
}
