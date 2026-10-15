import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { db } from '../../db/client'
import { type ColumnMapping, guessMapping, parseCSV, readStatement } from '../../engine/csv'
import { formatDay } from '../../engine/dates'
import type { ImportPreviewLine, Recurring } from '../../engine/expenses'
import { inputClass, Segmented, Toggle } from '../../ui/Controls'
import { Plus } from '../../ui/Icons'
import { ButtonRow, Row, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { showToast } from '../../ui/Toast'
import { categoryEmoji, INCOME_CATEGORIES, inr } from './format'

/** Import a bank or card statement saved as CSV. */
export function ImportScreen() {
  const navigate = useNavigate()
  const today = useToday()
  const settings = useDbQuery('moneySettings').data
  const [rows, setRows] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<ColumnMapping | null>(null)
  const [method, setMethod] = useState('')
  const [preview, setPreview] = useState<(ImportPreviewLine & { include: boolean })[] | null>(null)
  const [busy, setBusy] = useState(false)

  const read = useMemo(() => (rows && map ? readStatement(rows, map) : null), [rows, map])

  useEffect(() => {
    if (!read) return
    let cancelled = false
    db()
      .call('previewImport', { lines: read.lines })
      .then((p) => {
        if (!cancelled) setPreview(p.map((l) => ({ ...l, include: !l.duplicate && l.type === 'expense' })))
      })
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : String(e), 'error'))
    return () => {
      cancelled = true
    }
  }, [read])

  const load = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    if (parsed.length < 2) {
      showToast('That file has no rows to import. Choose a CSV file.', 'error')
      return
    }
    setFileName(file.name)
    setRows(parsed)
    setMap(guessMapping(parsed))
  }

  const header = rows && map ? rows[map.headerRow] ?? [] : []
  const columnSelect = (label: string, key: 'date' | 'description' | 'amount' | 'debit' | 'credit', allowNone = false) =>
    map && (
      <Row
        label={label}
        value={
          <select
            value={map[key]}
            onChange={(e) => setMap({ ...map, [key]: Number(e.target.value) })}
            className={`${inputClass} max-w-48 appearance-none`}
            aria-label={label}
          >
            {allowNone && <option value={-1}>None</option>}
            {header.map((h, i) => (
              <option key={i} value={i}>
                {h || `Column ${i + 1}`}
              </option>
            ))}
          </select>
        }
      />
    )

  const chosen = preview?.filter((l) => l.include) ?? []
  const total = chosen.filter((l) => l.type === 'expense').reduce((s, l) => s + l.amount, 0)

  const doImport = async () => {
    setBusy(true)
    const n = await act('importExpenses', { lines: chosen, method })
    setBusy(false)
    if (n !== undefined) {
      showToast(`Imported ${n} item${n === 1 ? '' : 's'}`)
      navigate('/money', { replace: true })
    }
  }

  const categories = settings?.categories ?? []

  return (
    <Page>
      <NavBar
        back={{ to: '/money/settings', label: 'Back' }}
        title="Import statement"
        right={
          preview ? (
            <BarButton bold onClick={doImport} disabled={busy || chosen.length === 0}>
              Import {chosen.length || ''}
            </BarButton>
          ) : undefined
        }
      />
      <div className="pt-4" />
      <Section
        title="Statement"
        footer="Download your statement as CSV from net banking or your card’s website (Excel files: open them and save as CSV first). Files stay on this phone."
      >
        <label className="block min-h-11 cursor-pointer px-4 py-2.5 text-accent active:bg-card-pressed">
          {fileName ? `${fileName} · choose another` : 'Choose CSV file…'}
          <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
        {rows && (
          <Row
            label="From"
            value={
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} max-w-48 appearance-none`} aria-label="Account or card">
                <option value="">Not set</option>
                {(settings?.methods ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            }
          />
        )}
      </Section>

      {map && (
        <Section title="Columns" footer="Check that these match your statement. Most bank statements have separate withdrawal and deposit columns; card statements usually have one amount column.">
          {columnSelect('Date', 'date')}
          {columnSelect('Description', 'description')}
          <div className="border-b-[0.5px] border-separator px-4 py-2.5">
            <Segmented
              label="Amount columns"
              value={map.amount >= 0 ? 'one' : 'two'}
              onChange={(v) =>
                setMap(
                  v === 'one'
                    ? { ...map, amount: Math.max(0, map.debit >= 0 ? map.debit : header.length - 1), debit: -1, credit: -1 }
                    : { ...map, amount: -1, debit: Math.max(0, header.length - 2), credit: Math.max(0, header.length - 1) },
                )
              }
              options={[
                { value: 'one', label: 'One amount column' },
                { value: 'two', label: 'Money out / in' },
              ]}
            />
          </div>
          {map.amount >= 0 ? (
            <>
              {columnSelect('Amount', 'amount')}
              <Row
                label="Plain amounts are spending"
                detail="On for card statements. Amounts marked Cr or with a minus sign are handled either way."
                action={<Toggle checked={map.positiveIsSpend} onChange={(v) => setMap({ ...map, positiveIsSpend: v })} label="Plain amounts are spending" />}
              />
            </>
          ) : (
            <>
              {columnSelect('Money out (debit)', 'debit', true)}
              {columnSelect('Money in (credit)', 'credit', true)}
            </>
          )}
          <Row
            label="Dates are written"
            value={
              <select value={map.dateOrder} onChange={(e) => setMap({ ...map, dateOrder: e.target.value as ColumnMapping['dateOrder'] })} className={`${inputClass} appearance-none`} aria-label="Date format">
                <option value="dmy">Day first (31/12/2026)</option>
                <option value="mdy">Month first (12/31/2026)</option>
                <option value="ymd">Year first (2026-12-31)</option>
              </select>
            }
          />
        </Section>
      )}

      {preview && (
        <Section
          title={`${preview.length} transactions · ${chosen.length} selected · ${inr(total)} spent`}
          footer={[
            preview.some((l) => l.duplicate) ? 'Items that look already added are unticked.' : '',
            preview.some((l) => l.type === 'income') ? 'Money coming in is unticked — card bill payments aren’t income. Tick salary, refunds and other real income.' : '',
            read?.skipped.length ? `${read.skipped.length} rows skipped (e.g. row ${read.skipped[0]!.row}: ${read.skipped[0]!.reason}).` : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex gap-4 border-b-[0.5px] border-separator px-4 py-2 text-[15px]">
            <button type="button" className="text-accent" onClick={() => setPreview(preview.map((l) => ({ ...l, include: true })))}>
              Select all
            </button>
            <button type="button" className="text-accent" onClick={() => setPreview(preview.map((l) => ({ ...l, include: false })))}>
              Select none
            </button>
          </div>
          {preview.map((l, i) => (
            <div key={`${l.row}-${i}`} className={`flex items-start gap-3 border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0 ${l.include ? '' : 'opacity-50'}`}>
              <input
                type="checkbox"
                checked={l.include}
                onChange={(e) => setPreview(preview.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                className="mt-1 h-5 w-5 accent-[var(--accent)]"
                aria-label={`Import ${l.description}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <span className="min-w-0 flex-1 truncate">{l.description}</span>
                  <span className={`tabular-nums ${l.type === 'income' ? 'text-good' : ''}`}>
                    {l.type === 'income' ? '+' : ''}
                    {inr(l.amount, true)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[13px] text-label-2">
                  <span>{formatDay(l.date, today)}</span>
                  {l.duplicate && <span className="text-warn">Already added?</span>}
                  <select
                    value={l.category ?? ''}
                    onChange={(e) => setPreview(preview.map((x, j) => (j === i ? { ...x, category: e.target.value || null } : x)))}
                    className="ml-auto max-w-40 appearance-none bg-transparent text-right text-accent outline-none"
                    aria-label={`Category for ${l.description}`}
                  >
                    <option value="">No category</option>
                    {categories
                      .filter((c) => (l.type === 'income') === INCOME_CATEGORIES.includes(c))
                      .map((c) => (
                        <option key={c} value={c}>
                          {categoryEmoji(c)} {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}
      {preview && preview.length > 0 && (
        <Section>
          <ButtonRow onClick={doImport} disabled={busy || chosen.length === 0}>
            {busy ? 'Importing…' : `Import ${chosen.length} item${chosen.length === 1 ? '' : 's'}`}
          </ButtonRow>
        </Section>
      )}
    </Page>
  )
}

/** Rent, subscriptions and other expenses that repeat. */
export function RecurringScreen() {
  const today = useToday()
  const { data } = useDbQuery('listRecurring')
  const settings = useDbQuery('moneySettings').data
  const [editing, setEditing] = useState<Partial<Recurring> | null>(null)

  const save = async () => {
    if (!editing) return
    const r = await act('saveRecurring', {
      id: editing.id,
      title: editing.title ?? '',
      amount: Number(editing.amount),
      category: editing.category,
      method: editing.method,
      freq: editing.freq ?? 'month',
      interval: editing.interval ?? 1,
      nextDate: editing.nextDate ?? today,
      active: editing.active ?? true,
    })
    if (r) {
      setEditing(null)
      if (r.nextDate <= today) {
        const n = await act('postDueRecurring', { today })
        if (n) showToast(`Added ${n} expense${n === 1 ? '' : 's'} that ${n === 1 ? 'was' : 'were'} due`)
      }
    }
  }

  const monthlyTotal = (data ?? [])
    .filter((r) => r.active)
    .reduce((s, r) => s + (r.freq === 'week' ? (r.amount * 52) / 12 / r.interval : r.freq === 'year' ? r.amount / 12 / r.interval : r.amount / r.interval), 0)

  const every = (r: Recurring) =>
    `${r.interval === 1 ? 'Every' : `Every ${r.interval}`} ${r.freq}${r.interval === 1 ? '' : 's'}`

  return (
    <Page>
      <NavBar back={{ to: '/money/settings', label: 'Back' }} title="Recurring" right={<BarButton label="Add recurring expense" onClick={() => setEditing({ freq: 'month', interval: 1, nextDate: today })}><Plus size={24} /></BarButton>} />
      <div className="pt-4" />
      <Section
        footer={
          data?.length
            ? `About ${inr(monthlyTotal)} a month. Each one is added to your expenses on its date, the next time you open the app.`
            : 'Add rent, subscriptions, EMIs or insurance. Each is added to your expenses automatically when it’s due.'
        }
      >
        {(data ?? []).map((r) => (
          <button key={r.id} type="button" onClick={() => setEditing(r)} className={`block w-full text-left ${r.active ? '' : 'opacity-50'}`}>
            <Row
              label={<span>{categoryEmoji(r.category)} {r.title}</span>}
              detail={`${every(r)} · next ${formatDay(r.nextDate, today)}${r.active ? '' : ' · paused'}`}
              value={inr(r.amount, true)}
            />
          </button>
        ))}
        {data?.length === 0 && (
          <button type="button" onClick={() => setEditing({ freq: 'month', interval: 1, nextDate: today })} className="block min-h-11 w-full px-4 py-2.5 text-left text-accent">
            Add a recurring expense
          </button>
        )}
      </Section>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit recurring' : 'New recurring'}
        right={
          <button type="button" onClick={save} disabled={!editing?.title?.trim() || !(Number(editing?.amount) > 0)} className="text-[17px] font-semibold text-accent disabled:opacity-30">
            Save
          </button>
        }
      >
        {editing && (
          <div className="space-y-3 px-4 pb-4">
            <div className="overflow-hidden rounded-[12px] bg-card">
              <input autoFocus value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Name, e.g. Rent, Netflix" className="block w-full border-b-[0.5px] border-separator bg-transparent px-4 py-3 outline-none placeholder:text-label-3" aria-label="Name" />
              <label className="flex items-center gap-2 border-b-[0.5px] border-separator px-4 py-2.5">
                <span className="flex-1">Amount</span>
                <span className="text-label-2">₹</span>
                <input value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: e.target.value as unknown as number })} inputMode="decimal" placeholder="0" className={`${inputClass} w-28`} aria-label="Amount" />
              </label>
              <label className="flex items-center gap-2 border-b-[0.5px] border-separator px-4 py-2.5">
                <span className="flex-1">Repeats</span>
                <select value={`${editing.interval ?? 1}-${editing.freq ?? 'month'}`} onChange={(e) => { const [i, f] = e.target.value.split('-'); setEditing({ ...editing, interval: Number(i), freq: f as Recurring['freq'] }) }} className={`${inputClass} appearance-none`} aria-label="Repeats">
                  <option value="1-week">Every week</option>
                  <option value="1-month">Every month</option>
                  <option value="3-month">Every 3 months</option>
                  <option value="6-month">Every 6 months</option>
                  <option value="1-year">Every year</option>
                </select>
              </label>
              <label className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1">Next due</span>
                <input type="date" value={editing.nextDate ?? today} onChange={(e) => setEditing({ ...editing, nextDate: e.target.value || today })} className="bg-transparent text-accent outline-none" aria-label="Next due" />
              </label>
            </div>
            <div className="overflow-hidden rounded-[12px] bg-card">
              <label className="flex items-center gap-2 border-b-[0.5px] border-separator px-4 py-2.5">
                <span className="flex-1">Category</span>
                <select value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={`${inputClass} appearance-none`} aria-label="Category">
                  <option value="">None</option>
                  {(settings?.categories ?? []).filter((c) => !INCOME_CATEGORIES.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1">Paid with</span>
                <select value={editing.method ?? ''} onChange={(e) => setEditing({ ...editing, method: e.target.value })} className={`${inputClass} appearance-none`} aria-label="Paid with">
                  <option value="">Not set</option>
                  {(settings?.methods ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
            {editing.id && (
              <div className="overflow-hidden rounded-[12px] bg-card">
                <Row label="Active" action={<Toggle checked={editing.active ?? true} onChange={(v) => setEditing({ ...editing, active: v })} label="Active" />} />
                <ButtonRow tone="bad" onClick={() => { void act('deleteRecurring', { id: editing.id! }); setEditing(null) }}>
                  Delete
                </ButtonRow>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Page>
  )
}
