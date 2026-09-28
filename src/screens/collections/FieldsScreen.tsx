import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { act, useDbQuery } from '../../app/data'
import { type Field, type FieldType, USER_FIELD_TYPES } from '../../engine/types'
import { inputClass } from '../../ui/Controls'
import { Row, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

const typeLabel = (t: FieldType) => USER_FIELD_TYPES.find((x) => x.type === t)?.label ?? t

function parseChoices(text: string) {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ id: '', label }))
}

/** Add, rename, reorder and remove a collection's fields. */
export function FieldsScreen() {
  const { id = '' } = useParams()
  const [search] = useSearchParams()
  const isNew = search.get('new') === '1'
  const { data: collection } = useDbQuery('getCollection', { id })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Field | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [choices, setChoices] = useState('')
  const [max, setMax] = useState('5')

  if (!collection) return <NavBar back={{ to: `/collections/${id}`, label: 'Back' }} />

  const openAdd = () => {
    setName('')
    setType('text')
    setChoices('')
    setMax('5')
    setAdding(true)
  }

  const openEdit = (f: Field) => {
    setName(f.name)
    setChoices((f.options.choices ?? []).map((c) => c.label).join(', '))
    setMax(String(f.options.max ?? 5))
    setEditing(f)
  }

  const add = async () => {
    if (!name.trim()) return
    const options =
      type === 'select' || type === 'multiselect'
        ? { choices: parseChoices(choices) }
        : type === 'rating'
          ? { max: Number(max) || 5 }
          : {}
    const f = await act('addField', { collectionId: id, name, type, options })
    if (f) setAdding(false)
  }

  const saveEdit = async () => {
    if (!editing) return
    const keep = new Map((editing.options.choices ?? []).map((c) => [c.label.toLowerCase(), c.id]))
    const options =
      editing.type === 'select' || editing.type === 'multiselect'
        ? { choices: parseChoices(choices).map((c) => ({ ...c, id: keep.get(c.label.toLowerCase()) ?? '' })) }
        : editing.type === 'rating'
          ? { max: Number(max) || 5 }
          : undefined
    await act('updateField', { id: editing.id, name, options })
    setEditing(null)
  }

  const remove = async (f: Field) => {
    if (!window.confirm(`Remove the field “${f.name}”? Its values will no longer show.`)) return
    await act('removeField', { id: f.id })
    setEditing(null)
  }

  const fields = collection.fields
  const typeSettings = (t: FieldType) =>
    t === 'select' || t === 'multiselect' ? (
      <div className="px-4 py-3">
        <div className="mb-1 text-[13px] text-label-2">Choices, separated by commas</div>
        <textarea
          value={choices}
          onChange={(e) => setChoices(e.target.value)}
          rows={2}
          placeholder="e.g. CERC, DERC, UPERC"
          className="w-full resize-none bg-transparent outline-none placeholder:text-label-3"
          aria-label="Choices"
        />
      </div>
    ) : t === 'rating' ? (
      <Row
        label="Highest rating"
        value={<input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" className={`${inputClass} w-12`} aria-label="Highest rating" />}
      />
    ) : null

  return (
    <Page>
      <NavBar
        back={{ to: `/collections/${id}`, label: collection.name }}
        title="Fields"
        right={
          isNew ? (
            <Link to={`/collections/${id}`} replace className="text-[17px] font-semibold text-accent">
              Done
            </Link>
          ) : undefined
        }
      />
      <div className="pt-4" />
      <Section
        footer={
          isNew
            ? 'Every item has a name and notes. Add the fields you want to fill in for each item, then tap Done.'
            : 'Tap a field to rename it or change its choices.'
        }
      >
        <Row label="Name" value="Built in" />
        {fields.map((f, i) => (
          <div key={f.id} className="flex min-h-11 items-center gap-3 border-b-[0.5px] border-separator pl-4 pr-4">
            <button type="button" onClick={() => openEdit(f)} className="min-w-0 flex-1 py-2.5 text-left active:opacity-60">
              <div>{f.name}</div>
              <div className="mt-0.5 text-[13px] text-label-2">{typeLabel(f.type)}</div>
            </button>
            <button
              type="button"
              aria-label={`Move ${f.name} up`}
              disabled={i === 0}
              onClick={() => void act('moveField', { id: f.id, direction: 'up' })}
              className="h-8 w-8 rounded-full bg-label-3/20 text-[15px] disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${f.name} down`}
              disabled={i === fields.length - 1}
              onClick={() => void act('moveField', { id: f.id, direction: 'down' })}
              className="h-8 w-8 rounded-full bg-label-3/20 text-[15px] disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        ))}
        <button type="button" onClick={openAdd} className="block min-h-11 w-full px-4 py-2.5 text-left text-accent active:bg-card-pressed">
          Add field
        </button>
      </Section>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="New field"
        right={
          <button type="button" onClick={add} disabled={!name.trim()} className="text-[17px] font-semibold text-accent disabled:opacity-30">
            Add
          </button>
        }
      >
        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-[10px] bg-card">
            <div className="border-b-[0.5px] border-separator px-4 py-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name, e.g. Regulator" className="w-full bg-transparent outline-none placeholder:text-label-3" aria-label="Field name" />
            </div>
            <Row
              label="Type"
              value={
                <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className={`${inputClass} appearance-none`} aria-label="Type">
                  {USER_FIELD_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              }
            />
            {typeSettings(type)}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit field"
        right={
          <button type="button" onClick={saveEdit} disabled={!name.trim()} className="text-[17px] font-semibold text-accent disabled:opacity-30">
            Save
          </button>
        }
      >
        {editing && (
          <div className="px-4 pb-4">
            <div className="overflow-hidden rounded-[10px] bg-card">
              <div className="border-b-[0.5px] border-separator px-4 py-3">
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent outline-none" aria-label="Field name" />
              </div>
              <Row label="Type" value={typeLabel(editing.type)} />
              {typeSettings(editing.type)}
            </div>
            <button type="button" onClick={() => remove(editing)} className="mt-4 w-full rounded-[10px] bg-card py-3 text-bad">
              Remove field
            </button>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
