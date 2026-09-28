/** Editors and read-only displays for record values, one per field type. */
import { formatDay } from '../../engine/dates'
import type { Field, FieldValue } from '../../engine/types'
import { inputClass, Toggle } from '../../ui/Controls'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 })

/** Short text for lists and tables. Empty string when there's no value. */
export function displayValue(field: Field, value: FieldValue | undefined, today: string): string {
  if (value === null || value === undefined || value === '') return ''
  switch (field.type) {
    case 'currency':
      return typeof value === 'number' ? inr.format(value) : String(value)
    case 'number':
      return typeof value === 'number' ? num.format(value) : String(value)
    case 'date':
      return typeof value === 'string' ? formatDay(value, today) : ''
    case 'checkbox':
      return value === true ? '✓' : ''
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value)
    case 'rating':
      return typeof value === 'number' ? '★'.repeat(value) : ''
    case 'url':
      return String(value).replace(/^https?:\/\//, '')
    default:
      return typeof value === 'object' ? '' : String(value)
  }
}

/** An editor for one field, laid out for the right side of a list row. */
export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
}) {
  const label = field.name
  switch (field.type) {
    case 'checkbox':
      return <Toggle checked={value === true} onChange={onChange} label={label} />
    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputClass}
          aria-label={label}
        />
      )
    case 'number':
    case 'currency':
      return (
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
          {field.type === 'currency' && <span className="text-label-2">₹</span>}
          <input
            key={String(value ?? '')}
            defaultValue={typeof value === 'number' ? String(value) : ''}
            inputMode="decimal"
            onBlur={(e) => {
              const raw = e.target.value.trim()
              if (raw === (typeof value === 'number' ? String(value) : '')) return
              onChange(raw === '' ? null : raw)
            }}
            placeholder="0"
            className={inputClass}
            aria-label={label}
          />
        </span>
      )
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={`${inputClass} appearance-none`}
          aria-label={label}
        >
          <option value="">None</option>
          {(field.options.choices ?? []).map((c) => (
            <option key={c.id} value={c.label}>
              {c.label}
            </option>
          ))}
          {typeof value === 'string' && value && !field.options.choices?.some((c) => c.label === value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      )
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : []
      return (
        <span className="flex flex-wrap justify-end gap-1.5">
          {(field.options.choices ?? []).map((c) => {
            const on = selected.includes(c.label)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((s) => s !== c.label) : [...selected, c.label])}
                className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${on ? 'bg-accent text-white' : 'bg-label-3/20'}`}
              >
                {c.label}
              </button>
            )
          })}
          {!field.options.choices?.length && <span className="text-[13px] text-label-3">Add choices in Fields</span>}
        </span>
      )
    }
    case 'rating': {
      const max = field.options.max ?? 5
      const n = typeof value === 'number' ? value : 0
      return (
        <span className="flex gap-0.5" role="radiogroup" aria-label={label}>
          {Array.from({ length: max }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={n === i + 1}
              aria-label={`${i + 1}`}
              onClick={() => onChange(n === i + 1 ? null : i + 1)}
              className={`text-[22px] leading-none ${i < n ? 'text-warn' : 'text-label-3'}`}
            >
              ★
            </button>
          ))}
        </span>
      )
    }
    case 'url':
      return (
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <input
            key={String(value ?? '')}
            defaultValue={typeof value === 'string' ? value : ''}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            onBlur={(e) => e.target.value !== (value ?? '') && onChange(e.target.value.trim() || null)}
            placeholder="https://"
            className={inputClass}
            aria-label={label}
          />
          {typeof value === 'string' && value && (
            <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-[15px] text-accent">
              Open
            </a>
          )}
        </span>
      )
    default:
      return (
        <input
          key={String(value ?? '')}
          defaultValue={typeof value === 'string' ? value : ''}
          onBlur={(e) => e.target.value !== (value ?? '') && onChange(e.target.value || null)}
          placeholder="Empty"
          className={inputClass}
          aria-label={label}
        />
      )
  }
}
