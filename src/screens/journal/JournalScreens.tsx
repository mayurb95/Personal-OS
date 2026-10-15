import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import { addDays, formatDay, formatDayWithWeekday, MONTH_SHORT } from '../../engine/dates'
import type { JournalEntry } from '../../engine/journal'
import { LineChart } from '../../ui/Charts'
import { AutoTextarea, EmptyState } from '../../ui/Controls'
import { ChevronLeft, ChevronRight, Flame } from '../../ui/Icons'
import { ButtonRow, Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { showToast } from '../../ui/Toast'

export const MOODS = [
  { value: 1, face: '😣', label: 'Awful' },
  { value: 2, face: '🙁', label: 'Bad' },
  { value: 3, face: '😐', label: 'Okay' },
  { value: 4, face: '🙂', label: 'Good' },
  { value: 5, face: '😄', label: 'Great' },
]

export function moodFace(m: number | null): string {
  return MOODS.find((x) => x.value === m)?.face ?? '·'
}

/**
 * Today's (or any day's) entry. Changes save as you go; the text saves a moment after you
 * stop typing and when you leave the field.
 */
export function JournalEditor({ day }: { day: string }) {
  const { data } = useDbQuery('journalDay', { day })
  const emotions = useDbQuery('emotionChoices').data ?? []
  const prompts = useDbQuery('journalPrompts').data ?? []
  const [text, setText] = useState('')
  const [prompt, setPrompt] = useState('')
  const loaded = useRef(false)
  const timer = useRef<number | null>(null)
  const latest = useRef({ text, prompt })
  latest.current = { text, prompt }

  // Load once per day; later refreshes must not overwrite what's being typed.
  useEffect(() => {
    if (!data || loaded.current) return
    loaded.current = true
    setText(data.entry?.text ?? '')
    setPrompt(data.prompt)
  }, [data])

  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        void act('saveEntry', { day, text: latest.current.text, prompt: latest.current.prompt })
      }
    },
    [day],
  )

  const entry: JournalEntry | null = data?.entry ?? null

  const saveText = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    if (text !== (entry?.text ?? '')) void act('saveEntry', { day, text, prompt })
  }

  const onType = (v: string) => {
    setText(v)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void act('saveEntry', { day, text: latest.current.text, prompt: latest.current.prompt })
    }, 900)
  }

  const set = (patch: { mood?: number | null; energy?: number | null; emotions?: string[] }) =>
    void act('saveEntry', { day, prompt, ...patch })

  const nextPrompt = () => {
    if (!prompts.length) return
    const i = prompts.indexOf(prompt)
    const p = prompts[(i + 1) % prompts.length]!
    setPrompt(p)
    if (entry) void act('saveEntry', { day, prompt: p })
  }

  if (!data) return <div className="h-64" />

  return (
    <>
      <Section title="Mood">
        <div className="flex justify-between px-3 py-3" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => {
            const on = entry?.mood === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ mood: on ? null : m.value })}
                className={`flex w-[19%] flex-col items-center rounded-[12px] py-2 ${on ? 'bg-accent/15' : ''}`}
              >
                <span className={`text-[30px] leading-none transition-transform ${on ? 'scale-110' : entry?.mood ? 'opacity-40' : ''}`}>{m.face}</span>
                <span className={`mt-1 text-[12px] ${on ? 'font-semibold text-accent' : 'text-label-2'}`}>{m.label}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t-[0.5px] border-separator px-4 py-2.5">
          <span className="text-[15px] text-label-2">Energy</span>
          <div className="flex flex-1 justify-end gap-1.5" role="radiogroup" aria-label="Energy">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = (entry?.energy ?? 0) >= n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={entry?.energy === n}
                  aria-label={`Energy ${n} of 5`}
                  onClick={() => set({ energy: entry?.energy === n ? null : n })}
                  className={`h-7 w-9 rounded-[6px] ${on ? 'bg-warn' : 'bg-label-3/25'}`}
                />
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t-[0.5px] border-separator px-4 py-3">
          {emotions.map((e) => {
            const on = entry?.emotions.includes(e) ?? false
            return (
              <button
                key={e}
                type="button"
                aria-pressed={on}
                onClick={() => set({ emotions: on ? entry!.emotions.filter((x) => x !== e) : [...(entry?.emotions ?? []), e] })}
                className={`rounded-full px-3 py-1.5 text-[14px] font-medium ${on ? 'bg-accent text-white' : 'bg-label-3/20'}`}
              >
                {e}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Entry">
        <div className="px-4 pt-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[15px] italic text-label-2">{prompt}</p>
            <button type="button" onClick={nextPrompt} className="shrink-0 text-[13px] text-accent">
              Another
            </button>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2">
          <AutoTextarea value={text} onChange={onType} onBlur={saveText} placeholder="Write as much or as little as you like…" ariaLabel="Journal entry" className="min-h-32 text-[17px] leading-relaxed" />
        </div>
      </Section>
    </>
  )
}

const shortDate = (day: string) => `${Number(day.slice(8))} ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}`

export function JournalScreen() {
  const today = useToday()
  const stats = useDbQuery('journalStats', { today }).data
  const past = useDbQuery('listEntries', { to: addDays(today, -1), limit: 30 }).data ?? []
  const memories = useDbQuery('onThisDay', { day: today }).data ?? []
  const habits = useDbQuery('moodByHabit', { today }).data ?? []

  return (
    <Page>
      <NavBar back={{ to: '/more', label: 'More' }} title="Journal" right={<Link to="/journal/settings" className="text-[17px] text-accent">Prompts</Link>} />
      <div className="px-4 pb-3 pt-4">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{formatDayWithWeekday(today)}</div>
        <h1 className="text-[28px] font-bold leading-tight">How was today?</h1>
      </div>
      <JournalEditor key={today} day={today} />

      {stats && stats.entries30 > 0 && (
        <>
          <div className="mx-4 mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-[12px] bg-card p-3">
              <div className="flex items-center gap-1 text-[26px] font-bold leading-none"><Flame size={20} className="text-warn" />{stats.streak}</div>
              <div className="mt-1.5 text-[12px] text-label-2">Day streak</div>
            </div>
            <div className="rounded-[12px] bg-card p-3">
              <div className="text-[26px] font-bold leading-none">{stats.entries30}</div>
              <div className="mt-1.5 text-[12px] text-label-2">Entries in 30 days</div>
            </div>
            <div className="rounded-[12px] bg-card p-3">
              <div className="text-[26px] font-bold leading-none">{stats.avgMood30 ? `${moodFace(Math.round(stats.avgMood30))} ${stats.avgMood30}` : '–'}</div>
              <div className="mt-1.5 text-[12px] text-label-2">Average mood</div>
            </div>
          </div>
          {stats.mood.length > 1 && (
            <Section title="Mood, last 30 days">
              <LineChart
                ariaLabel="Mood over the last 30 days, 1 awful to 5 great"
                data={stats.mood.map((m) => ({ label: shortDate(m.day), detail: `${formatDay(m.day, today)} · ${MOODS[m.mood - 1]!.label}`, value: m.mood }))}
                format={(v) => `${moodFace(Math.round(v))} ${v}`}
              />
            </Section>
          )}
        </>
      )}

      {memories.length > 0 && (
        <Section title="On this day">
          {memories.map((m) => (
            <Link key={m.entry.id} to={`/journal/${m.entry.day}`} className="block">
              <Row label={`${moodFace(m.entry.mood)} ${m.label}`} detail={m.entry.text ? m.entry.text.slice(0, 140) : m.entry.emotions.join(', ')} />
            </Link>
          ))}
        </Section>
      )}

      {habits.length > 0 && (
        <Section title="Mood and habits" footer="Average mood on days you did each habit, compared with days you didn’t, over the last 90 days. It shows patterns, not causes.">
          {habits.map((h) => (
            <Row
              key={h.habit}
              label={h.habit}
              detail={`${h.doneDays} days done · ${h.otherDays} not`}
              value={
                <span className={h.moodDone > h.moodOther ? 'text-good' : h.moodDone < h.moodOther ? 'text-bad' : ''}>
                  {h.moodDone} vs {h.moodOther}
                </span>
              }
            />
          ))}
        </Section>
      )}

      <Section title="Earlier">
        {past.map((e) => (
          <Link key={e.id} to={`/journal/${e.day}`} className="block">
            <Row label={<span>{moodFace(e.mood)} {formatDay(e.day, today)}</span>} detail={e.text ? e.text.slice(0, 120) : e.emotions.join(', ') || undefined} />
          </Link>
        ))}
        {past.length === 0 && <div className="px-4 py-3 text-[15px] text-label-2">Past entries will show here.</div>}
        <Link to={`/journal/${addDays(today, -1)}`} className="block">
          <Row label={<span className="text-accent">Write for an earlier day</span>} />
        </Link>
      </Section>
    </Page>
  )
}

export function JournalDayScreen() {
  const { day = '' } = useParams()
  const today = useToday()
  const navigate = useNavigate()
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day)
  if (!valid) return <EmptyState title="That date isn’t valid" />
  return (
    <Page>
      <NavBar
        back={{ to: '/journal', label: 'Journal' }}
        title={formatDay(day, today)}
        right={
          <span className="flex items-center gap-4">
            <button type="button" aria-label="Previous day" onClick={() => navigate(`/journal/${addDays(day, -1)}`, { replace: true })} className="text-accent">
              <ChevronLeft size={22} />
            </button>
            <button type="button" aria-label="Next day" disabled={day >= today} onClick={() => navigate(`/journal/${addDays(day, 1)}`, { replace: true })} className="text-accent disabled:opacity-25">
              <ChevronRight size={22} />
            </button>
          </span>
        }
      />
      <div className="px-4 pb-3 pt-4">
        <h1 className="text-[28px] font-bold leading-tight">{formatDayWithWeekday(day)} {day.slice(0, 4)}</h1>
      </div>
      <JournalEditor key={day} day={day} />
    </Page>
  )
}

export function JournalSettingsScreen() {
  const { data } = useDbQuery('journalPrompts')
  const [text, setText] = useState('')
  useEffect(() => {
    if (data) setText(data.join('\n'))
  }, [data])
  return (
    <Page>
      <NavBar back={{ to: '/journal', label: 'Journal' }} title="Prompts" />
      <div className="pt-4" />
      <Section title="Prompts" footer="One per line. Each day shows the next prompt in the list; tap Another to skip ahead.">
        <div className="px-4 py-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="w-full resize-y bg-transparent outline-none" aria-label="Prompts" />
        </div>
        <ButtonRow onClick={() => void act('setJournalPrompts', { prompts: text.split('\n') }).then((r) => r && showToast('Prompts saved'))}>Save prompts</ButtonRow>
      </Section>
    </Page>
  )
}
