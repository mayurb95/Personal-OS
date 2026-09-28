/**
 * iOS-style grouped list building blocks: a Section holds Rows, like the Settings app.
 */
import type { ReactNode } from 'react'

export type Status = 'good' | 'warn' | 'bad' | 'neutral'

const dotColour: Record<Status, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-label-3',
}

export function Section({
  title,
  footer,
  children,
}: {
  title?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mx-4 mb-8">
      {title && (
        <h2 className="mb-1.5 px-4 text-[13px] uppercase tracking-wide text-label-2">{title}</h2>
      )}
      <div className="overflow-hidden rounded-[10px] bg-card">{children}</div>
      {footer && <div className="mt-1.5 px-4 text-[13px] leading-snug text-label-2">{footer}</div>}
    </section>
  )
}

export function Row({
  label,
  value,
  detail,
  status,
  onClick,
  action,
}: {
  label: ReactNode
  value?: ReactNode
  detail?: ReactNode
  status?: Status
  onClick?: () => void
  action?: ReactNode
}) {
  const body = (
    <div className="flex min-h-11 items-center gap-3 py-2.5 pr-4">
      {status && (
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColour[status]}`}
          aria-label={status === 'good' ? 'OK' : status === 'neutral' ? 'Info' : 'Needs attention'}
        />
      )}
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        {detail && <div className="mt-0.5 text-[13px] leading-snug text-label-2">{detail}</div>}
      </div>
      {value != null && <div className="shrink-0 text-right text-label-2">{value}</div>}
      {action}
    </div>
  )
  const rowClass =
    'block w-full border-b-[0.5px] border-separator pl-4 text-left last:border-b-0'
  return onClick ? (
    <button type="button" className={`${rowClass} active:bg-card-pressed`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={rowClass}>{body}</div>
  )
}

export function ButtonRow({
  children,
  onClick,
  disabled,
  tone = 'accent',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'accent' | 'bad'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block min-h-11 w-full border-b-[0.5px] border-separator px-4 py-2.5 text-left last:border-b-0 active:bg-card-pressed disabled:opacity-40 ${
        tone === 'bad' ? 'text-bad' : 'text-accent'
      }`}
    >
      {children}
    </button>
  )
}
