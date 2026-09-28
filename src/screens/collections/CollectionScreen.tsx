import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { act, useDbQuery, useToday } from '../../app/data'
import type { Collection, RecordItem, ViewSettings } from '../../engine/types'
import { EmptyState, FloatingAdd, Segmented } from '../../ui/Controls'
import { Ellipsis, SearchIcon } from '../../ui/Icons'
import { Section } from '../../ui/List'
import { BarButton, NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { ButtonRow } from '../../ui/List'
import { showToast } from '../../ui/Toast'
import { displayValue } from './FieldInput'

const DEFAULT_VIEW: ViewSettings = { layout: 'list', sort: { key: 'created_at', dir: 'desc' } }

/** One collection's records, as a list or a table, with sorting and a text filter. */
export function CollectionScreen() {
  const { id = '' } = useParams()
  const today = useToday()
  const navigate = useNavigate()
  const { data: collection, error } = useDbQuery('getCollection', { id })
  const view = collection?.settings.view ?? DEFAULT_VIEW
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const { data: records } = useDbQuery('listRecords', { collectionId: id, sort: view.sort, text })

  if (error || collection === null) {
    return (
      <Page>
        <NavBar back={{ to: '/collections', label: 'Collections' }} />
        <p className="p-8 text-center text-label-2">{error ?? 'This collection no longer exists.'}</p>
      </Page>
    )
  }
  if (!collection) return <NavBar back={{ to: '/collections', label: 'Collections' }} />

  const setView = (patch: Partial<ViewSettings>) =>
    void act('updateCollection', { id, settings: { view: { ...view, ...patch } } })

  const addRecord = async () => {
    const r = await act('createRecord', { collectionId: id, title: '' })
    if (r) navigate(`/records/${r.id}?new=1`)
  }

  const rename = async () => {
    const name = window.prompt('Collection name', collection.name)
    if (name?.trim()) await act('updateCollection', { id, name })
    setMenu(false)
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${collection.name}”? Its ${records?.length ?? 0} items go to the trash, where you can restore them for 30 days.`)) return
    await act('deleteCollection', { id })
    showToast('Collection deleted')
    navigate('/collections', { replace: true })
  }

  const visibleFields = collection.fields.filter((f) => !f.hidden)
  const sortOptions = [
    { key: 'created_at', label: 'Date added' },
    { key: 'updated_at', label: 'Last edited' },
    { key: 'title', label: 'Name' },
    ...visibleFields.map((f) => ({ key: f.key, label: f.name })),
  ]

  return (
    <Page>
      <NavBar
        back={{ to: '/collections', label: 'Collections' }}
        title={`${collection.icon} ${collection.name}`}
        right={
          <BarButton label="Collection options" onClick={() => setMenu(true)}>
            <Ellipsis size={26} />
          </BarButton>
        }
      />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <label className="flex items-center gap-2 rounded-[10px] bg-label-3/20 px-3 py-2">
          <SearchIcon size={18} className="text-label-2" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
            aria-label="Filter"
          />
        </label>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <Segmented
              label="Layout"
              value={view.layout}
              onChange={(layout) => setView({ layout })}
              options={[
                { value: 'list', label: 'List' },
                { value: 'table', label: 'Table' },
              ]}
            />
          </div>
          <select
            value={`${view.sort.key}:${view.sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':') as [string, 'asc' | 'desc']
              setView({ sort: { key, dir } })
            }}
            className="min-w-0 flex-1 appearance-none bg-transparent text-right text-[15px] text-accent outline-none"
            aria-label="Sort"
          >
            {sortOptions.flatMap((o) => [
              <option key={`${o.key}:asc`} value={`${o.key}:asc`}>
                {o.label} ↑
              </option>,
              <option key={`${o.key}:desc`} value={`${o.key}:desc`}>
                {o.label} ↓
              </option>,
            ])}
          </select>
        </div>
      </div>

      {records && records.length === 0 && (
        <EmptyState title={text ? 'No matches' : 'Nothing here yet'}>
          {text ? 'Try another word.' : 'Tap + to add the first item.'}
        </EmptyState>
      )}
      {records && records.length > 0 && view.layout === 'list' && (
        <Section>
          {records.map((r) => (
            <ListRow key={r.id} record={r} collection={collection} today={today} />
          ))}
        </Section>
      )}
      {records && records.length > 0 && view.layout === 'table' && (
        <Table records={records} collection={collection} today={today} />
      )}

      <FloatingAdd label="New item" onClick={addRecord} />

      <Sheet open={menu} onClose={() => setMenu(false)} title={collection.name}>
        <div className="px-4 pb-2">
          <div className="overflow-hidden rounded-[10px] bg-card">
            <ButtonRow onClick={() => navigate(`/collections/${id}/fields`)}>Edit fields</ButtonRow>
            <ButtonRow onClick={rename}>Rename</ButtonRow>
            <ButtonRow tone="bad" onClick={remove}>
              Delete collection
            </ButtonRow>
          </div>
        </div>
      </Sheet>
    </Page>
  )
}

function ListRow({ record, collection, today }: { record: RecordItem; collection: Collection; today: string }) {
  const values = collection.fields
    .filter((f) => !f.hidden)
    .map((f) => [f, displayValue(f, record.data[f.key], today)] as const)
    .filter(([, v]) => v)
    .slice(0, 3)
  return (
    <Link
      to={`/records/${record.id}`}
      className="block border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0 active:bg-card-pressed"
    >
      <div className={record.title ? '' : 'text-label-3'}>{record.title || 'Untitled'}</div>
      {values.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-label-2">
          {values.map(([f, v]) => (
            <span key={f.id}>
              <span className="text-label-3">{f.name}:</span> {v}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

function Table({ records, collection, today }: { records: RecordItem[]; collection: Collection; today: string }) {
  const fields = collection.fields.filter((f) => !f.hidden)
  const navigate = useNavigate()
  return (
    <div className="mx-4 mb-8 overflow-x-auto rounded-[10px] bg-card">
      <table className="min-w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-left text-[13px] text-label-2">
            <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Name</th>
            {fields.map((f) => (
              <th key={f.id} className="whitespace-nowrap px-3 py-2 font-medium">
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              onClick={() => navigate(`/records/${r.id}`)}
              className="cursor-pointer border-t-[0.5px] border-separator active:bg-card-pressed"
            >
              <td className="sticky left-0 z-10 max-w-44 truncate bg-card px-3 py-2.5 font-medium">
                {r.title || <span className="text-label-3">Untitled</span>}
              </td>
              {fields.map((f) => (
                <td key={f.id} className="max-w-56 truncate whitespace-nowrap px-3 py-2.5 text-label-2">
                  {displayValue(f, r.data[f.key], today)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
