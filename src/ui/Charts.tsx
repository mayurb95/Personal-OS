/**
 * Small, dependency-free SVG charts for one series of numbers.
 * Thin marks, recessive axes, and tap (or hover) to read an exact value.
 */
import { useId, useState } from 'react'

export interface Point {
  label: string
  value: number
  /** Optional longer label for the readout, e.g. "Week of 5 Oct". */
  detail?: string
}

const W = 340
const H = 150
const PAD = { top: 12, right: 8, bottom: 22, left: 34 }

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const f = max / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

function compact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e7) return `${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`
  if (a >= 1e5) return `${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`
  return String(Math.round(n * 10) / 10)
}

function Readout({ point, format }: { point: Point | undefined; format: (v: number) => string }) {
  return (
    <div className="h-5 px-1 text-[13px] text-label-2" aria-live="polite">
      {point ? (
        <>
          <span className="font-semibold text-label">{format(point.value)}</span> · {point.detail ?? point.label}
        </>
      ) : (
        'Tap a point for its value'
      )}
    </div>
  )
}

/** Vertical bars from zero. Every `labelEvery`-th label is shown on the axis. */
export function BarChart({
  data,
  format = compact,
  labelEvery = 1,
  highlightLast = false,
  limit,
  ariaLabel,
  integer = false,
}: {
  data: Point[]
  format?: (v: number) => string
  labelEvery?: number
  highlightLast?: boolean
  /** Counts: keep axis ticks on whole numbers. */
  integer?: boolean
  /** Optional reference line, e.g. a budget. */
  limit?: number
  ariaLabel: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const raw = Math.max(...data.map((d) => d.value), limit ?? 0)
  const max = integer ? Math.max(2, Math.ceil(raw / 2) * 2) : niceMax(raw)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, data.length)
  const barW = Math.max(3, Math.min(28, slot - 2))
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  return (
    <figure className="px-3 pb-2 pt-3">
      <Readout point={active === null ? undefined : data[active]} format={format} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--separator)" strokeWidth={0.5} />
            <text x={PAD.left - 6} y={y(max * f) + 3.5} textAnchor="end" fontSize={10} fill="var(--label-2)">
              {compact(max * f)}
            </text>
          </g>
        ))}
        {limit !== undefined && limit > 0 && (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(limit)} y2={y(limit)} stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2
          const h = Math.max(d.value > 0 ? 2 : 0, y(0) - y(d.value))
          const r = Math.min(4, barW / 2, h)
          const top = y(0) - h
          const strong = active === i || (active === null && highlightLast && i === data.length - 1)
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`}
                  fill="var(--accent)"
                  opacity={strong || active === null ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--label-2)">
                  {d.label}
                </text>
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onClick={() => setActive(active === i ? null : i)}
                onMouseEnter={() => setActive(i)}
              >
                <title>{`${d.detail ?? d.label}: ${format(d.value)}`}</title>
              </rect>
            </g>
          )
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--label-3)" strokeWidth={1} />
      </svg>
    </figure>
  )
}

/** A line over time with dots at each point. The y-axis fits the data's range. */
export function LineChart({
  data,
  format = compact,
  ariaLabel,
  zeroBased = false,
}: {
  data: Point[]
  format?: (v: number) => string
  ariaLabel: string
  zeroBased?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  if (data.length === 0) return null
  const values = data.map((d) => d.value)
  let lo = zeroBased ? 0 : Math.min(...values)
  let hi = Math.max(...values)
  if (hi === lo) {
    hi += 1
    lo = Math.max(0, lo - 1)
  }
  const span = hi - lo
  lo = zeroBased ? 0 : lo - span * 0.1
  hi = hi + span * 0.1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const showLabel = (i: number) => i === 0 || i === data.length - 1 || (data.length > 6 && i === Math.floor(data.length / 2))
  return (
    <figure className="px-3 pb-2 pt-3">
      <Readout point={active === null ? data.at(-1) : data[active]} format={format} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[lo, (lo + hi) / 2, hi].map((v, k) => (
          <g key={k}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--separator)" strokeWidth={0.5} />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--label-2)">
              {compact(v)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--label-3)" strokeWidth={1} />
        )}
        {data.map((d, i) => (
          <g key={`${id}-${i}`}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={active === i ? 5 : data.length > 30 ? 0 : 3.5}
              fill="var(--accent)"
              stroke="var(--card)"
              strokeWidth={2}
            />
            {showLabel(i) && (
              <text
                x={x(i)}
                y={H - 6}
                textAnchor={i === 0 && data.length > 1 ? 'start' : i === data.length - 1 && data.length > 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--label-2)"
              >
                {d.label}
              </text>
            )}
            <rect
              x={x(i) - innerW / Math.max(2, data.length) / 2}
              y={PAD.top}
              width={innerW / Math.max(2, data.length)}
              height={innerH}
              fill="transparent"
              onClick={() => setActive(active === i ? null : i)}
              onMouseEnter={() => setActive(i)}
            >
              <title>{`${d.detail ?? d.label}: ${format(d.value)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
    </figure>
  )
}

/** A horizontal progress bar, e.g. spending against a budget. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max > 0 ? value / max : 0
  const tone = ratio >= 1 ? 'bg-bad' : ratio >= 0.8 ? 'bg-warn' : 'bg-accent'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-label-3/25" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  )
}
