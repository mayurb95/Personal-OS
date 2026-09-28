import type { ReactNode } from 'react'

/** A tab's root screen, with an iOS-style large title that scrolls with its content. */
export function Screen({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pb-28">
      <header className="flex items-end gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="min-w-0 flex-1">
          {subtitle && (
            <div className="text-[13px] font-semibold uppercase tracking-wide text-label-2">
              {subtitle}
            </div>
          )}
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-4 pb-1.5 text-accent">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

/** Wrapper for screens that use a NavBar instead of a large title. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="pb-28">{children}</div>
}
