import { NavLink } from 'react-router'
import { Ellipsis, Flame } from './Icons'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/tasks', label: 'Tasks', icon: TasksIcon, end: false },
  { to: '/habits', label: 'Habits', icon: HabitsIcon, end: false },
  { to: '/more', label: 'More', icon: MoreIcon, end: false },
]

/** Bottom tab bar, iOS style, clear of the Home indicator. */
export function TabBar() {
  return (
    <nav
      className="grid shrink-0 border-t-[0.5px] border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 pb-1 pt-1.5 text-[10px] font-medium ${
              isActive ? 'text-accent' : 'text-label-2'
            }`
          }
        >
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function TodayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.8" fill="currentColor" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.3 12.3l2.4 2.4 5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HabitsIcon() {
  return <Flame size={26} strokeWidth={1.7} />
}

function MoreIcon() {
  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.7px] border-current">
      <Ellipsis size={18} />
    </span>
  )
}
