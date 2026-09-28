import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { act, useDbQuery } from '../../app/data'
import type { FieldValue } from '../../engine/types'
import { AutoTextarea } from '../../ui/Controls'
import { Trash } from '../../ui/Icons'
import { ButtonRow, Section } from '../../ui/List'
import { NavBar } from '../../ui/NavBar'
import { Page } from '../../ui/Screen'
import { showToast } from '../../ui/Toast'
import { FieldInput } from './FieldInput'

/** One item in a collection: its name, every field, and free-form notes. Changes save as you go. */
export function RecordScreen() {
  const { id = '' } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { data: record, error } = useDbQuery('getRecord', { id })
  const { data: collection } = useDbQuery('getCollection', { id: record?.collectionId ?? '' })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (record) {
      setTitle(record.title)
      setBody(record.body)
    }
  }, [record])

  const back = collection
    ? { to: `/collections/${collection.id}`, label: collection.name }
    : { to: '/collections', label: 'Back' }

  if (error || record === null) {
    return (
      <Page>
        <NavBar back={back} />
        <p className="p-8 text-center text-label-2">{error ?? 'This item no longer exists.'}</p>
      </Page>
    )
  }
  if (!record || !collection) return <NavBar back={back} />

  const saveText = () => {
    if (title !== record.title || body !== record.body) void act('updateRecord', { id, title, body })
  }

  const setValue = (key: string, value: FieldValue) =>
    void act('updateRecord', { id, data: { [key]: value } })

  const remove = async () => {
    await act('trashRecord', { id })
    showToast('Moved to trash', 'info', { label: 'Undo', run: () => void act('restoreRecord', { id }) })
    navigate(back.to, { replace: true })
  }

  const fields = collection.fields.filter((f) => !f.hidden)
  const edited = new Date(record.updatedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <Page>
      <NavBar back={back} />
      <div className="px-4 pb-6 pt-4">
        <AutoTextarea
          value={title}
          onChange={setTitle}
          onBlur={saveText}
          placeholder="Untitled"
          autoFocus={search.get('new') === '1'}
          ariaLabel="Name"
          className="text-[28px] font-bold leading-tight"
        />
      </div>
      {fields.length > 0 && (
        <Section>
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex min-h-11 items-center gap-3 border-b-[0.5px] border-separator py-2 pl-4 pr-4 last:border-b-0"
            >
              <span className="w-32 shrink-0 text-label-2">{f.name}</span>
              <div className="flex min-w-0 flex-1 justify-end">
                <FieldInput field={f} value={record.data[f.key]} onChange={(v) => setValue(f.key, v)} />
              </div>
            </div>
          ))}
        </Section>
      )}
      <Section title="Notes">
        <div className="px-4 py-3">
          <AutoTextarea value={body} onChange={setBody} onBlur={saveText} placeholder="Write anything…" ariaLabel="Notes" className="min-h-24" />
        </div>
      </Section>
      <Section>
        <ButtonRow tone="bad" onClick={remove}>
          <span className="flex items-center gap-2">
            <Trash size={18} /> Delete
          </span>
        </ButtonRow>
      </Section>
      <p className="px-8 text-center text-[13px] text-label-3">Last edited {edited}</p>
    </Page>
  )
}
