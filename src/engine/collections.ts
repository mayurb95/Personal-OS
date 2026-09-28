/** Collections and their fields: the schema layer of the engine. */
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import { newId, nowISO } from './clock'
import type {
  Collection,
  CollectionKind,
  CollectionSettings,
  CollectionSummary,
  Field,
  FieldOptions,
  FieldType,
} from './types'
import { USER_FIELD_TYPES } from './types'

type Row = Record<string, SqlValue>

function parseJSON<T>(value: SqlValue | undefined, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function fieldFromRow(row: Row): Field {
  return {
    id: String(row.id),
    collectionId: String(row.collection_id),
    key: String(row.key),
    name: String(row.name),
    type: String(row.type) as FieldType,
    options: parseJSON<FieldOptions>(row.options, {}),
    sort: Number(row.sort),
    builtin: Number(row.builtin) === 1,
    hidden: Number(row.hidden) === 1,
  }
}

export function listCollections(db: Database, p: { includeBuiltin?: boolean } = {}): CollectionSummary[] {
  const rows = db.selectObjects(
    `SELECT c.id, c.kind, c.name, c.icon,
            (SELECT count(*) FROM records r WHERE r.collection_id = c.id AND r.deleted_at IS NULL) AS n
     FROM collections c
     WHERE c.archived_at IS NULL ${p.includeBuiltin ? '' : "AND c.kind = 'custom'"}
     ORDER BY c.sort, c.name COLLATE NOCASE`,
  )
  return rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind) as CollectionKind,
    name: String(r.name),
    icon: String(r.icon),
    recordCount: Number(r.n),
  }))
}

export function getCollection(db: Database, p: { id: string }): Collection | null {
  const row = db.selectObjects('SELECT * FROM collections WHERE id = ?', [p.id])[0]
  if (!row) return null
  const fields = db
    .selectObjects('SELECT * FROM fields WHERE collection_id = ? ORDER BY sort, created_at', [p.id])
    .map(fieldFromRow)
  return {
    id: String(row.id),
    kind: String(row.kind) as CollectionKind,
    name: String(row.name),
    icon: String(row.icon),
    settings: parseJSON<CollectionSettings>(row.settings, {}),
    sort: Number(row.sort),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    fields,
  }
}

export function requireCollection(db: Database, id: string): Collection {
  const c = getCollection(db, { id })
  if (!c) throw new Error('That collection no longer exists.')
  return c
}

/** Turns a field name into a stable key: "Order date" → "order_date". */
export function slugKey(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'field'
}

export interface NewField {
  name: string
  type: FieldType
  options?: FieldOptions
}

export function createCollection(
  db: Database,
  p: { name: string; icon?: string; fields?: NewField[] },
): { id: string } {
  const name = p.name.trim()
  if (!name) throw new Error('Give the collection a name.')
  const id = newId()
  const now = nowISO()
  db.transaction((tx) => {
    const maxSort = Number(tx.selectValue('SELECT coalesce(max(sort), 0) FROM collections') ?? 0)
    tx.exec({
      sql: `INSERT INTO collections (id, kind, name, icon, settings, sort, created_at, updated_at)
            VALUES (?, 'custom', ?, ?, ?, ?, ?, ?)`,
      bind: [
        id,
        name,
        p.icon?.trim() || '📁',
        JSON.stringify({ view: { layout: 'list', sort: { key: 'created_at', dir: 'desc' } } }),
        maxSort + 1,
        now,
        now,
      ],
    })
    for (const f of p.fields ?? []) addField(tx, { collectionId: id, ...f })
  })
  return { id }
}

export function updateCollection(
  db: Database,
  p: { id: string; name?: string; icon?: string; settings?: CollectionSettings },
): void {
  const c = requireCollection(db, p.id)
  const name = p.name?.trim()
  if (p.name !== undefined && !name) throw new Error('Give the collection a name.')
  db.exec({
    sql: 'UPDATE collections SET name = ?, icon = ?, settings = ?, updated_at = ? WHERE id = ?',
    bind: [
      name ?? c.name,
      p.icon?.trim() || c.icon,
      JSON.stringify({ ...c.settings, ...(p.settings ?? {}) }),
      nowISO(),
      p.id,
    ],
  })
}

/** Moves every record to the trash and hides the collection. Restoring a record brings it back. */
export function deleteCollection(db: Database, p: { id: string }): void {
  const c = requireCollection(db, p.id)
  if (c.kind !== 'custom') throw new Error('Built-in collections can’t be deleted.')
  const now = nowISO()
  db.transaction((tx) => {
    tx.exec({
      sql: 'UPDATE records SET deleted_at = ? WHERE collection_id = ? AND deleted_at IS NULL',
      bind: [now, p.id],
    })
    tx.exec({ sql: 'UPDATE collections SET archived_at = ? WHERE id = ?', bind: [now, p.id] })
  })
}

export function addField(
  db: Database,
  p: { collectionId: string } & NewField,
): Field {
  const name = p.name.trim()
  if (!name) throw new Error('Give the field a name.')
  if (!USER_FIELD_TYPES.some((t) => t.type === p.type)) {
    throw new Error(`Unsupported field type: ${p.type}`)
  }
  const existing = new Set(
    db
      .selectValues('SELECT key FROM fields WHERE collection_id = ?', [p.collectionId])
      .map(String),
  )
  const reserved = new Set(['title', 'body', 'created_at', 'updated_at', 'id'])
  const base = slugKey(name)
  let key = base
  for (let i = 2; existing.has(key) || reserved.has(key); i++) key = `${base}_${i}`
  const sort =
    Number(
      db.selectValue('SELECT coalesce(max(sort), 0) FROM fields WHERE collection_id = ?', [
        p.collectionId,
      ]) ?? 0,
    ) + 1
  const id = newId()
  const options = normaliseOptions(p.type, p.options)
  db.exec({
    sql: `INSERT INTO fields (id, collection_id, key, name, type, options, sort, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [id, p.collectionId, key, name, p.type, JSON.stringify(options), sort, nowISO()],
  })
  return fieldFromRow(db.selectObjects('SELECT * FROM fields WHERE id = ?', [id])[0]!)
}

function normaliseOptions(type: FieldType, options: FieldOptions = {}): FieldOptions {
  if (type === 'select' || type === 'multiselect') {
    const seen = new Set<string>()
    const choices = (options.choices ?? [])
      .map((c) => ({ id: c.id || newId(), label: c.label.trim() }))
      .filter((c) => c.label && !seen.has(c.label.toLowerCase()) && seen.add(c.label.toLowerCase()))
    return { choices }
  }
  if (type === 'rating') return { max: Math.min(10, Math.max(3, options.max ?? 5)) }
  if (type === 'currency') return { currency: options.currency ?? 'INR' }
  return {}
}

export function updateField(
  db: Database,
  p: { id: string; name?: string; options?: FieldOptions; hidden?: boolean },
): void {
  const row = db.selectObjects('SELECT * FROM fields WHERE id = ?', [p.id])[0]
  if (!row) throw new Error('That field no longer exists.')
  const field = fieldFromRow(row)
  const name = p.name?.trim()
  if (p.name !== undefined && !name) throw new Error('Give the field a name.')
  if (field.builtin && p.name !== undefined && name !== field.name) {
    throw new Error('Built-in fields can’t be renamed.')
  }
  db.exec({
    sql: 'UPDATE fields SET name = ?, options = ?, hidden = ? WHERE id = ?',
    bind: [
      name ?? field.name,
      JSON.stringify(p.options ? normaliseOptions(field.type, p.options) : field.options),
      p.hidden === undefined ? Number(field.hidden) : Number(p.hidden),
      p.id,
    ],
  })
}

/** Adds a choice to a select field if it isn't there yet (case-insensitive). Returns its label. */
export function ensureChoice(db: Database, fieldId: string, label: string): string {
  const row = db.selectObjects('SELECT * FROM fields WHERE id = ?', [fieldId])[0]
  if (!row) throw new Error('That field no longer exists.')
  const field = fieldFromRow(row)
  const clean = label.trim()
  const match = field.options.choices?.find((c) => c.label.toLowerCase() === clean.toLowerCase())
  if (match) return match.label
  const choices = [...(field.options.choices ?? []), { id: newId(), label: clean }]
  db.exec({
    sql: 'UPDATE fields SET options = ? WHERE id = ?',
    bind: [JSON.stringify({ ...field.options, choices }), fieldId],
  })
  return clean
}

export function moveField(db: Database, p: { id: string; direction: 'up' | 'down' }): void {
  const row = db.selectObjects('SELECT * FROM fields WHERE id = ?', [p.id])[0]
  if (!row) return
  const field = fieldFromRow(row)
  const siblings = db
    .selectObjects('SELECT * FROM fields WHERE collection_id = ? ORDER BY sort, created_at', [
      field.collectionId,
    ])
    .map(fieldFromRow)
  const index = siblings.findIndex((f) => f.id === field.id)
  const swapWith = siblings[p.direction === 'up' ? index - 1 : index + 1]
  if (!swapWith) return
  db.transaction((tx) => {
    siblings.forEach((f, i) => {
      let sort = i
      if (f.id === field.id) sort = p.direction === 'up' ? i - 1 : i + 1
      else if (f.id === swapWith.id) sort = p.direction === 'up' ? i + 1 : i - 1
      tx.exec({ sql: 'UPDATE fields SET sort = ? WHERE id = ?', bind: [sort, f.id] })
    })
  })
}

/** Removes a field definition. Values already stored under its key are left in place but unused. */
export function removeField(db: Database, p: { id: string }): void {
  const row = db.selectObjects('SELECT * FROM fields WHERE id = ?', [p.id])[0]
  if (!row) return
  if (fieldFromRow(row).builtin) throw new Error('Built-in fields can’t be removed.')
  db.exec({ sql: 'DELETE FROM fields WHERE id = ?', bind: [p.id] })
}
