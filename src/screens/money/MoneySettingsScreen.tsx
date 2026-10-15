import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { db } from '../../db/client'
import { saveFile } from '../../lib/share'
import { inputClass } from '../../ui/Controls'
import { ButtonRow, Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { showToast } from '../../ui/Toast'
import { categoryEmoji, INCOME_CATEGORIES, monthLabel, shiftMonth } from './format'

function BudgetInput({ category, value }: { category: string; value: number | undefined }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-label-2">₹</span>
      <input
        key={String(value ?? '')}
        defaultValue={value ?? ''}
        inputMode="numeric"
        placeholder="No budget"
        onBlur={(e) => {
          const t = e.target.value.replace(/[,\s₹]/g, '')
          const n = t ? Number(t) : null
          if ((n ?? undefined) !== value) void act('setBudget', { category, amount: n && Number.isFinite(n) ? n : null })
        }}
        className={`${inputClass} w-28`}
        aria-label={`Monthly budget for ${category === '__total' ? 'all spending' : category}`}
      />
    </span>
  )
}

/** Budgets, categories, payment methods, recurring expenses, import and export. */
export function MoneySettingsScreen() {
  const today = useToday()
  const { data: s } = useDbQuery('moneySettings')
  const [cats, setCats] = useState('')
  const [methods, setMethods] = useState('')
  const [exportMonth, setExportMonth] = useState(today.slice(0, 7))
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (!s) return
    setCats(s.categories.join('\n'))
    setMethods(s.methods.join('\n'))
  }, [s])

  const lines = (t: string) => [...new Set(t.split(/[\n,]/).map((x) => x.trim()).filter(Boolean))]

  const prepareExport = async (allTime: boolean) => {
    const from = allTime ? '1990-01-01' : `${exportMonth}-01`
    const to = allTime ? '2100-12-31' : `${exportMonth}-31`
    const csv = await db().call('exportExpensesCSV', { from, to })
    setFile(new File([csv], allTime ? 'personal-os-money-all.csv' : `personal-os-money-${exportMonth}.csv`, { type: 'text/csv' }))
  }

  if (!s) return <NavBar back={{ to: '/money', label: 'Money' }} />
  const spendCats = s.categories.filter((c) => !INCOME_CATEGORIES.includes(c))

  return (
    <Page>
      <NavBar back={{ to: '/money', label: 'Money' }} title="Money settings" />
      <div className="pt-4" />
      <Section>
        <Link to="/money/import" className="block">
          <Row label="Import a bank or card statement" detail="CSV file from net banking or your card portal" />
        </Link>
        <Link to="/money/recurring" className="block">
          <Row label="Recurring expenses" detail="Rent, subscriptions, EMIs — added automatically when due" />
        </Link>
      </Section>

      <Section title="Monthly budgets" footer="You’ll get a message when spending reaches 80% and 100% of a budget.">
        <Row label="All spending" action={<BudgetInput category="__total" value={s.budgets.__total} />} />
        {spendCats.map((c) => (
          <Row key={c} label={<span>{categoryEmoji(c)} {c}</span>} action={<BudgetInput category={c} value={s.budgets[c]} />} />
        ))}
      </Section>

      <Section title="Categories" footer="One per line. Removing a category doesn’t change expenses that already use it.">
        <div className="px-4 py-3">
          <textarea value={cats} onChange={(e) => setCats(e.target.value)} rows={8} className="w-full resize-y bg-transparent outline-none" aria-label="Categories" />
        </div>
        <ButtonRow onClick={() => void act('setMoneyChoices', { kind: 'category', labels: lines(cats) }).then((r) => r !== undefined && showToast('Categories saved'))}>
          Save categories
        </ButtonRow>
      </Section>

      <Section title="Payment methods" footer="One per line, e.g. each card, UPI, cash.">
        <div className="px-4 py-3">
          <textarea value={methods} onChange={(e) => setMethods(e.target.value)} rows={5} className="w-full resize-y bg-transparent outline-none" aria-label="Payment methods" />
        </div>
        <ButtonRow onClick={() => void act('setMoneyChoices', { kind: 'method', labels: lines(methods) }).then((r) => r !== undefined && showToast('Payment methods saved'))}>
          Save payment methods
        </ButtonRow>
      </Section>

      <Section title="Export" footer="A CSV file that opens in Excel, Numbers or Google Sheets.">
        <Row
          label="Month"
          value={
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => { setExportMonth(shiftMonth(exportMonth, -1)); setFile(null) }} className="text-accent" aria-label="Previous month">‹</button>
              {monthLabel(exportMonth)}
              <button type="button" onClick={() => { setExportMonth(shiftMonth(exportMonth, 1)); setFile(null) }} className="text-accent" aria-label="Next month">›</button>
            </span>
          }
        />
        {file ? (
          <ButtonRow
            onClick={() =>
              saveFile(file).then(
                (ok) => ok && (setFile(null), showToast('Exported')),
                (e: unknown) => showToast(e instanceof Error ? e.message : String(e), 'error'),
              )
            }
          >
            Save {file.name}
          </ButtonRow>
        ) : (
          <>
            <ButtonRow onClick={() => void prepareExport(false)}>Export {monthLabel(exportMonth)}</ButtonRow>
            <ButtonRow onClick={() => void prepareExport(true)}>Export everything</ButtonRow>
          </>
        )}
      </Section>

      {Object.keys(s.rates).length > 0 && (
        <Section title="Exchange rates you’ve used">
          {Object.entries(s.rates).map(([c, r]) => (
            <Row key={c} label={`1 ${c}`} value={`₹${r}`} />
          ))}
        </Section>
      )}
    </Page>
  )
}
