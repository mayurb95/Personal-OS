import type { ReactNode } from 'react'

/** A screen with an iOS-style large title that scrolls with its content. */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pb-6">
      <header className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        {subtitle && (
          <div className="text-[13px] font-semibold uppercase tracking-wide text-label-2">
            {subtitle}
          </div>
        )}
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
      </header>
      {children}
    </div>
  )
}
