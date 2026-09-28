import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from './Icons'

/**
 * Top bar for screens below a tab's root: a back button, a small title and optional actions.
 * `back` is where to go when the app was opened straight onto this screen (no history).
 */
export function NavBar({
  title,
  back,
  right,
}: {
  title?: ReactNode
  back?: { to: string; label: string }
  right?: ReactNode
}) {
  const navigate = useNavigate()
  const goBack = (e: React.MouseEvent) => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) {
      e.preventDefault()
      navigate(-1)
    }
  }
  return (
    <header className="sticky top-0 z-20 border-b-[0.5px] border-separator bg-bar pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="grid h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-2">
        <div className="flex min-w-0 items-center">
          {back && (
            <Link
              to={back.to}
              onClick={goBack}
              className="flex min-w-0 items-center text-accent active:opacity-50"
            >
              <ChevronLeft size={24} />
              <span className="truncate text-[17px]">{back.label}</span>
            </Link>
          )}
        </div>
        <div className="max-w-[50vw] truncate text-center text-[17px] font-semibold">{title}</div>
        <div className="flex items-center justify-end gap-3 pr-2">{right}</div>
      </div>
    </header>
  )
}

/** Text or icon button for a navigation bar. */
export function BarButton({
  children,
  onClick,
  bold,
  disabled,
  label,
}: {
  children: ReactNode
  onClick: () => void
  bold?: boolean
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 items-center text-[17px] text-accent active:opacity-50 disabled:opacity-30 ${
        bold ? 'font-semibold' : ''
      }`}
    >
      {children}
    </button>
  )
}
