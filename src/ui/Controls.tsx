/** Small form controls in the iOS style. */
import { type ReactNode, useEffect, useRef } from 'react'
import { Check, Plus } from './Icons'

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-good' : 'bg-label-3'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-label-3/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-8 flex-1 rounded-[7px] px-2 text-[13px] font-medium transition-colors ${
            value === o.value ? 'bg-card shadow-sm' : 'text-label'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The round tick-box used for tasks and habits. */
export function CheckCircle({
  checked,
  onToggle,
  tone = 'neutral',
  label,
  size = 24,
}: {
  checked: boolean
  onToggle: () => void
  tone?: 'neutral' | 'bad' | 'warn' | 'accent' | 'good'
  label: string
  size?: number
}) {
  const ring = {
    neutral: 'border-label-3',
    bad: 'border-bad',
    warn: 'border-warn',
    accent: 'border-accent',
    good: 'border-good',
  }[tone]
  const fill = tone === 'neutral' ? 'bg-accent border-accent' : {
    bad: 'bg-bad border-bad',
    warn: 'bg-warn border-warn',
    accent: 'bg-accent border-accent',
    good: 'bg-good border-good',
  }[tone]
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="-m-2.5 flex shrink-0 items-center justify-center p-2.5"
    >
      <span
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-full border-[1.5px] transition-colors ${
          checked ? `${fill} text-white` : ring
        }`}
      >
        {checked && <Check size={size * 0.62} />}
      </span>
    </button>
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'bad' | 'accent' }) {
  const colour = tone === 'bad' ? 'text-bad' : tone === 'accent' ? 'text-accent' : 'text-label-2'
  return <span className={`inline-flex items-center gap-1 text-[13px] ${colour}`}>{children}</span>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-8 my-10 text-center">
      <div className="text-[17px] font-semibold">{title}</div>
      {children && <div className="mt-1.5 text-[15px] leading-snug text-label-2">{children}</div>}
    </div>
  )
}

/** Round "+" button that floats above the tab bar. */
export function FloatingAdd({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+68px)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
    >
      <Plus size={28} />
    </button>
  )
}

/** A textarea that grows with its content. */
export function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className = '',
  autoFocus,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  ariaLabel?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`block w-full resize-none bg-transparent outline-none placeholder:text-label-3 ${className}`}
    />
  )
}

/** Plain input styled for use inside a list row. */
export const inputClass =
  'min-w-0 flex-1 bg-transparent text-right text-label outline-none placeholder:text-label-3'
