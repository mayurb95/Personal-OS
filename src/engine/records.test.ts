import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { freshDb } from '../test/db'
import {
  addField,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  moveField,
  removeField,
  slugKey,
  updateField,
} from './collections'
import {
  createRecord,
  emptyTrash,
  ftsQuery,
  listRecords,
  listTrash,
  purgeRecord,
  restoreRecord,
  search,
  trashRecord,
  updateRecord,
} from './records'

let db: Database

beforeEach(async () => {
  db = await freshDb()
})

describe('built-in collections', () => {
  it('seeds Tasks and Habits with their fields', () => {
    const tasks = getCollection(db, { id: 'tasks' })!
    expect(tasks.kind).toBe('tasks')
    expect(tasks.fields.map((f) => f.key)).toContain('due')
    expect(getCollection(db, { id: 'habits' })!.kind).toBe('habits')
    expect(listCollections(db)).toEqual([])
    expect(listCollections(db, { includeBuiltin: true }).map((c) => c.id)).toEqual(['tasks', 'habits'])
  })
})

describe('collections and fields', () => {
  it('creates a collection with fields and unique keys', () => {
    const { id } = createCollection(db, {
      name: 'Regulatory filings',
      icon: '📑',
      fields: [
        { name: 'Regulator', type: 'select', options: { choices: [{ id: '', label: 'CERC' }, { id: '', label: 'cerc' }] } },
        { name: 'Order date', type: 'date' },
        { name: 'Order date', type: 'date' },
        { name: 'Title', type: 'text' },
      ],
    })
    const c = getCollection(db, { id })!
    expect(c.name).toBe('Regulatory filings')
    expect(c.fields.map((f) => f.key)).toEqual(['regulator', 'order_date', 'order_date_2', 'title_2'])
    expect(c.fields[0]!.options.choices).toHaveLength(1)
    expect(listCollections(db)[0]).toMatchObject({ id, recordCount: 0 })
  })

  it('rejects blank names and unknown types', () => {
    expect(() => createCollection(db, { name: '  ' })).toThrow()
    const { id } = createCollection(db, { name: 'X' })
    expect(() => addField(db, { collectionId: id, name: 'A', type: 'json' })).toThrow()
  })

  it('renames, reorders and removes fields', () => {
    const { id } = createCollection(db, {
      name: 'Books',
      fields: [
        { name: 'Author', type: 'text' },
        { name: 'Rating', type: 'rating' },
      ],
    })
    const [author, rating] = getCollection(db, { id })!.fields
    updateField(db, { id: author!.id, name: 'Writer' })
    moveField(db, { id: rating!.id, direction: 'up' })
    let fields = getCollection(db, { id })!.fields
    expect(fields.map((f) => f.name)).toEqual(['Rating', 'Writer'])
    removeField(db, { id: rating!.id })
    fields = getCollection(db, { id })!.fields
    expect(fields.map((f) => f.key)).toEqual(['author'])
  })

  it('slugs names into keys', () => {
    expect(slugKey('Order Date')).toBe('order_date')
    expect(slugKey('Café ☕')).toBe('cafe')
    expect(slugKey('!!!')).toBe('field')
  })
})

describe('records', () => {
  it('coerces values to field types and merges patches', () => {
    const { id } = createCollection(db, {
      name: 'Books',
      fields: [
        { name: 'Pages', type: 'number' },
        { name: 'Done', type: 'checkbox' },
        { name: 'Finished', type: 'date' },
        { name: 'Tags', type: 'multiselect' },
        { name: 'Stars', type: 'rating' },
      ],
    })
    const r = createRecord(db, {
      collectionId: id,
      title: '  Power Sector Reforms ',
      data: { pages: '1,200', done: 'true', finished: 'not a date', tags: ['a', 'a', ' b '], stars: 9 },
    })
    expect(r.title).toBe('Power Sector Reforms')
    expect(r.data).toEqual({ pages: 1200, done: true, tags: ['a', 'b'], stars: 5 })
    const u = updateRecord(db, { id: r.id, data: { pages: null, finished: '2026-09-28' } })
    expect(u.data).toEqual({ done: true, tags: ['a', 'b'], stars: 5, finished: '2026-09-28' })
  })

  it('lists with sorting and text filter', () => {
    const { id } = createCollection(db, { name: 'Books', fields: [{ name: 'Pages', type: 'number' }] })
    createRecord(db, { collectionId: id, title: 'B', data: { pages: 300 } })
    createRecord(db, { collectionId: id, title: 'A', data: { pages: 100 } })
    createRecord(db, { collectionId: id, title: 'C' })
    const byPages = listRecords(db, { collectionId: id, sort: { key: 'pages', dir: 'asc' } })
    expect(byPages.map((r) => r.title)).toEqual(['A', 'B', 'C'])
    const byTitle = listRecords(db, { collectionId: id, sort: { key: 'title', dir: 'desc' } })
    expect(byTitle.map((r) => r.title)).toEqual(['C', 'B', 'A'])
    expect(listRecords(db, { collectionId: id, text: 'b' }).map((r) => r.title)).toEqual(['B'])
  })

  it('moves to trash, restores and purges', () => {
    const { id } = createCollection(db, { name: 'Notes' })
    const r = createRecord(db, { collectionId: id, title: 'Keep me' })
    trashRecord(db, { id: r.id })
    expect(listRecords(db, { collectionId: id })).toHaveLength(0)
    expect(listTrash(db).map((t) => t.id)).toEqual([r.id])
    restoreRecord(db, { id: r.id })
    expect(listRecords(db, { collectionId: id })).toHaveLength(1)
    trashRecord(db, { id: r.id })
    purgeRecord(db, { id: r.id })
    expect(listTrash(db)).toHaveLength(0)
  })

  it('empties the trash', () => {
    const { id } = createCollection(db, { name: 'Notes' })
    const r = createRecord(db, { collectionId: id, title: 'Old' })
    trashRecord(db, { id: r.id })
    expect(emptyTrash(db, { olderThanDays: 30 })).toBe(0)
    expect(emptyTrash(db)).toBe(1)
  })

  it('deleting a collection trashes its records; restoring one brings it back', () => {
    const { id } = createCollection(db, { name: 'Temp' })
    const r = createRecord(db, { collectionId: id, title: 'Thing' })
    deleteCollection(db, { id })
    expect(listCollections(db)).toHaveLength(0)
    restoreRecord(db, { id: r.id })
    expect(listCollections(db)).toHaveLength(1)
  })
})

describe('search', () => {
  it('finds words by prefix across collections, skipping the trash', () => {
    const { id } = createCollection(db, { name: 'Notes' })
    createRecord(db, { collectionId: id, title: 'Tariff order notes', body: 'Discom AT&C losses review' })
    const gone = createRecord(db, { collectionId: id, title: 'Tariff draft' })
    trashRecord(db, { id: gone.id })
    createRecord(db, { collectionId: 'tasks', title: 'Read tariff petition' })
    const hits = search(db, { query: 'tari' })
    expect(hits.map((h) => h.title).sort()).toEqual(['Read tariff petition', 'Tariff order notes'])
    expect(search(db, { query: 'losses rev' })[0]!.snippet).toContain('losses')
    expect(search(db, { query: '  ' })).toEqual([])
  })

  it('builds safe queries', () => {
    expect(ftsQuery('AT&C "loss')).toBe('"AT"* "C"* "loss"*')
    expect(ftsQuery('***')).toBeNull()
  })
})
