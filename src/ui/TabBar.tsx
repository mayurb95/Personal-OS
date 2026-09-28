import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon },
  { to: '/system', label: 'System check', icon: CheckIcon },
]

/** Bottom tab bar, iOS style, clear of the Home indicator. */
export function TabBar() {
  return (
    <nav
      className="grid shrink-0 border-t-[0.5px] border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
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

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.7-7 9-4.1-1.3-7-4.7-7-9V6.3l7-2.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
