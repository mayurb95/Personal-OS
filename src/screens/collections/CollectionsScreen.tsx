import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { act, useDbQuery } from '../../app/data'
import { EmptyState } from '../../ui/Controls'
import { Plus } from '../../ui/Icons'
import { Row, Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { primeKeyboard } from '../../ui/Sheet'

/** The user's own collections — Notion-style databases with custom fields. */
export function CollectionsScreen() {
  const { data } = useDbQuery('listCollections')
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📁')

  const create = async () => {
    if (!name.trim()) return
    const result = await act('createCollection', { name, icon })
    if (result) {
      setCreating(false)
      setName('')
      navigate(`/collections/${result.id}/fields?new=1`)
    }
  }

  return (
    <Page>
      <NavBar
        title="Collections"
        back={{ to: '/more', label: 'More' }}
        right={
          <BarButton
            label="New collection"
            onClick={() => {
              primeKeyboard()
              setCreating(true)
            }}
          >
            <Plus size={24} />
          </BarButton>
        }
      />
      <div className="pt-4" />
      {data && data.length === 0 && (
        <EmptyState title="No collections yet">
          A collection is a list of anything with its own fields — regulatory filings, books to buy,
          travel bookings. Tap + to make one.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <Section>
          {data.map((c) => (
            <Link key={c.id} to={`/collections/${c.id}`} className="block">
              <Row
                label={
                  <span className="flex items-center gap-3">
                    <span className="text-[22px] leading-none">{c.icon}</span>
                    {c.name}
                  </span>
                }
                value={c.recordCount}
              />
            </Link>
          ))}
        </Section>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New collection"
        right={
          <button type="button" onClick={create} disabled={!name.trim()} className="text-[17px] font-semibold text-accent disabled:opacity-30">
            Create
          </button>
        }
      >
        <form
          className="px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <div className="flex items-center gap-3 rounded-[10px] bg-card px-4 py-3">
            <input
              value={icon}
              onChange={(e) => setIcon([...e.target.value].slice(-1).join('') || '📁')}
              className="w-9 bg-transparent text-center text-[24px] outline-none"
              aria-label="Icon (an emoji)"
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name, e.g. Regulatory filings"
              enterKeyHint="done"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-3"
              aria-label="Name"
            />
          </div>
          <p className="mt-2 text-[13px] text-label-2">Tap the icon to pick an emoji. You’ll add fields next.</p>
        </form>
      </Sheet>
    </Page>
  )
}
