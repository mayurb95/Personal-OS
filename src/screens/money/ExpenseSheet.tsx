import { useEffect, useRef, useState } from 'react'
import { act, useDbQuery, useToday } from '../../app/data'
import { formatDay } from '../../engine/dates'
import type { Expense, MoneyType } from '../../engine/expenses'
import { Segmented } from '../../ui/Controls'
import { Sheet } from '../../ui/Sheet'
import { showToast } from '../../ui/Toast'
import { categoryEmoji, CURRENCIES, INCOME_CATEGORIES, inr } from './format'

/**
 * Add or edit an expense (or income). Open it from a tap after calling primeKeyboard(),
 * so the amount field gets the keyboard straight away on iPhone.
 */
export function ExpenseSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Expense | null
}) {
  const today = useToday()
  const settings = useDbQuery('moneySettings').data
  const [type, setType] = useState<MoneyType>('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [rate, setRate] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type)
      setAmount(String(editing.originalAmount ?? editing.amount))
      setCurrency(editing.currency ?? 'INR')
      setRate(editing.rate ? String(editing.rate) : '')
      setCategory(editing.category)
      setMethod(editing.method)
      setTitle(editing.title === editing.category ? '' : editing.title)
      setDate(editing.date)
      setNote(editing.note)
    } else {
      setType('expense')
      setAmount('')
      setCategory('')
      setTitle('')
      setDate(today)
      setNote('')
    }
    amountRef.current?.focus()
  }, [open, editing, today])

  useEffect(() => {
    if (currency !== 'INR' && !rate && settings?.rates[currency]) setRate(String(settings.rates[currency]))
  }, [currency, rate, settings])

  const value = Number(amount.replace(/,/g, ''))
  const rateValue = Number(rate)
  const inINR = currency === 'INR' ? value : value * rateValue
  const valid = value > 0 && (currency === 'INR' || rateValue > 0)

  const categories = (settings?.categories ?? []).filter((c) =>
    type === 'income' ? INCOME_CATEGORIES.includes(c) : !INCOME_CATEGORIES.includes(c),
  )
  if (type === 'income' && !categories.length) categories.push(...INCOME_CATEGORIES)

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    const input = { amount: value, currency, rate: currency === 'INR' ? null : rateValue, date, title, note, category, method, type }
    const result = editing ? await act('updateExpense', { id: editing.id, ...input }) : await act('addExpense', input)
    setBusy(false)
    if (!result) return
    onClose()
    const a = result.alert
    if (a) {
      const what = a.category === 'Total' ? 'your monthly budget' : `your ${a.category} budget`
      showToast(a.level >= 100 ? `Over ${what}: ${inr(a.spent)} of ${inr(a.budget)}` : `${a.level}% of ${what} used`, a.level >= 100 ? 'error' : 'info')
    } else showToast(editing ? 'Saved' : type === 'income' ? 'Income added' : 'Expense added')
  }

  const remove = async () => {
    if (!editing) return
    await act('trashRecord', { id: editing.id })
    onClose()
    showToast('Moved to trash', 'info', { label: 'Undo', run: () => void act('restoreRecord', { id: editing.id }) })
  }

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-[14px] font-medium ${on ? 'bg-accent text-white' : 'bg-card'}`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit' : type === 'income' ? 'New income' : 'New expense'}
      right={
        <button type="button" onClick={save} disabled={!valid || busy} className="text-[17px] font-semibold text-accent disabled:opacity-30">
          Save
        </button>
      }
    >
      <form
        className="space-y-4 px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Segmented<MoneyType>
          label="Type"
          value={type}
          onChange={(t) => {
            setType(t)
            setCategory('')
          }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <div className="flex items-center gap-2 rounded-[12px] bg-card px-4 py-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="appearance-none bg-transparent text-[20px] font-semibold text-accent outline-none"
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === 'INR' ? '₹' : c}
              </option>
            ))}
          </select>
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent text-[34px] font-bold tabular-nums outline-none placeholder:text-label-3"
            aria-label="Amount"
          />
        </div>
        {currency !== 'INR' && (
          <div className="flex items-center gap-2 rounded-[12px] bg-card px-4 py-2.5 text-[15px]">
            <span className="text-label-2">1 {currency} =</span>
            <span>₹</span>
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="rate" className="w-24 bg-transparent tabular-nums outline-none placeholder:text-label-3" aria-label="Exchange rate in rupees" />
            <span className="ml-auto text-label-2">{valid ? `= ${inr(inINR, true)}` : ''}</span>
          </div>
        )}

        <div>
          <div className="mb-1.5 px-1 text-[13px] text-label-2">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(category === c ? '' : c)} className={chip(category === c)}>
                {categoryEmoji(c)} {c}
              </button>
            ))}
          </div>
        </div>

        {type === 'expense' && (
          <div>
            <div className="mb-1.5 px-1 text-[13px] text-label-2">Paid with</div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {(settings?.methods ?? []).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(method === m ? '' : m)} className={chip(method === m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-[12px] bg-card">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'income' ? 'From (optional)' : 'What for, e.g. Swiggy (optional)'} className="block w-full border-b-[0.5px] border-separator bg-transparent px-4 py-3 outline-none placeholder:text-label-3" aria-label="Description" />
          <label className="flex items-center justify-between border-b-[0.5px] border-separator px-4 py-2.5">
            <span>Date</span>
            <span className="flex items-center gap-2 text-label-2">
              {formatDay(date, today)}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} className="w-32 bg-transparent text-right text-accent outline-none" aria-label="Date" />
            </span>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="block w-full bg-transparent px-4 py-3 outline-none placeholder:text-label-3" aria-label="Note" />
        </div>
        <button type="submit" hidden aria-hidden="true" />
        {editing && (
          <button type="button" onClick={remove} className="w-full rounded-[12px] bg-card py-3 text-bad">
            Delete
          </button>
        )}
      </form>
    </Sheet>
  )
}
