/** Records: the rows of every collection (tasks, habits and the user's own collections). */
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import { clock, newId, nowISO } from './clock'
import { requireCollection } from './collections'
import { isISODate } from './dates'
import type {
  CollectionKind,
  Field,
  FieldValue,
  RecordData,
  RecordItem,
  SearchHit,
  TrashItem,
} from './types'

type Row = Record<string, SqlValue>

export function recordFromRow(row: Row): RecordItem {
  let data: RecordData = {}
  try {
    data = JSON.parse(String(row.data)) as RecordData
  } catch {
    data = {}
  }
  return {
    id: String(row.id),
    collectionId: String(row.collection_id),
    title: String(row.title ?? ''),
    data,
    body: String(row.body ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
  }
}

/** Cleans a value to fit its field's type; returns null for "no value". */
export function coerceValue(field: Field, value: unknown): FieldValue {
  if (value === undefined || value === null || value === '') return null
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'rating': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
      if (!Number.isFinite(n)) return null
      if (field.type === 'rating') return Math.max(0, Math.min(field.options.max ?? 5, Math.round(n)))
      return n
    }
    case 'priority': {
      const n = Number(value)
      return n >= 1 && n <= 4 ? Math.round(n) : null
    }
    case 'checkbox':
      return value === true || value === 'true' || value === 1
    case 'date':
      return isISODate(value) ? value : null
    case 'multiselect': {
      const list = Array.isArray(value) ? value : [value]
      const clean = [...new Set(list.map((v) => String(v).trim()).filter(Boolean))]
      return clean.length ? clean : null
    }
    case 'json':
      return typeof value === 'object' ? (value as Record<string, unknown>) : null
    default:
      return String(value)
  }
}

function fieldsByKey(db: Database, collectionId: string): Map<string, Field> {
  return new Map(requireCollection(db, collectionId).fields.map((f) => [f.key, f]))
}

/** Applies a patch to record data: known fields are coerced, null removes a value. */
export function mergeData(fields: Map<string, Field>, current: RecordData, patch: RecordData): RecordData {
  const next: RecordData = { ...current }
  for (const [key, raw] of Object.entries(patch)) {
    const field = fields.get(key)
    const value = field ? coerceValue(field, raw) : raw
    if (value === null || value === undefined) delete next[key]
    else next[key] = value
  }
  return next
}

export function getRecord(db: Database, p: { id: string }): RecordItem | null {
  const row = db.selectObjects('SELECT * FROM records WHERE id = ?', [p.id])[0]
  return row ? recordFromRow(row) : null
}

export function requireRecord(db: Database, id: string): RecordItem {
  const r = getRecord(db, { id })
  if (!r) throw new Error('That item no longer exists.')
  return r
}

export function createRecord(
  db: Database,
  p: { collectionId: string; title?: string; data?: RecordData; body?: string },
): RecordItem {
  const fields = fieldsByKey(db, p.collectionId)
  const data = mergeData(fields, {}, p.data ?? {})
  const id = newId()
  const now = nowISO()
  db.exec({
    sql: `INSERT INTO records (id, collection_id, title, data, body, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    bind: [id, p.collectionId, (p.title ?? '').trim(), JSON.stringify(data), p.body ?? '', now, now],
  })
  return requireRecord(db, id)
}

export function updateRecord(
  db: Database,
  p: { id: string; title?: string; data?: RecordData; body?: string },
): RecordItem {
  const current = requireRecord(db, p.id)
  const data = p.data ? mergeData(fieldsByKey(db, current.collectionId), current.data, p.data) : current.data
  db.exec({
    sql: 'UPDATE records SET title = ?, data = ?, body = ?, updated_at = ? WHERE id = ?',
    bind: [
      p.title !== undefined ? p.title.trim() : current.title,
      JSON.stringify(data),
      p.body ?? current.body,
      nowISO(),
      p.id,
    ],
  })
  return requireRecord(db, p.id)
}

export function trashRecord(db: Database, p: { id: string }): void {
  db.exec({
    sql: 'UPDATE records SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    bind: [nowISO(), p.id],
  })
}

export function restoreRecord(db: Database, p: { id: string }): void {
  const r = requireRecord(db, p.id)
  db.transaction((tx) => {
    tx.exec({ sql: 'UPDATE records SET deleted_at = NULL WHERE id = ?', bind: [p.id] })
    tx.exec({ sql: 'UPDATE collections SET archived_at = NULL WHERE id = ?', bind: [r.collectionId] })
  })
}

export function purgeRecord(db: Database, p: { id: string }): void {
  db.exec({ sql: 'DELETE FROM records WHERE id = ? AND deleted_at IS NOT NULL', bind: [p.id] })
}

export function listTrash(db: Database): TrashItem[] {
  return db
    .selectObjects(
      `SELECT r.id, r.title, r.collection_id, r.deleted_at, c.name, c.icon
       FROM records r JOIN collections c ON c.id = r.collection_id
       WHERE r.deleted_at IS NOT NULL
       ORDER BY r.deleted_at DESC`,
    )
    .map((r) => ({
      id: String(r.id),
      title: String(r.title),
      collectionId: String(r.collection_id),
      collectionName: String(r.name),
      collectionIcon: String(r.icon),
      deletedAt: String(r.deleted_at),
    }))
}

/** Permanently deletes trashed items. With `olderThanDays`, only items trashed before then. */
export function emptyTrash(db: Database, p: { olderThanDays?: number } = {}): number {
  const cutoff =
    p.olderThanDays === undefined
      ? '9999'
      : new Date(clock.now().getTime() - p.olderThanDays * 86_400_000).toISOString()
  db.exec({ sql: 'DELETE FROM records WHERE deleted_at IS NOT NULL AND deleted_at < ?', bind: [cutoff] })
  return db.changes()
}

export interface ListRecordsParams {
  collectionId: string
  sort?: { key: string; dir: 'asc' | 'desc' }
  text?: string
  limit?: number
}

export function listRecords(db: Database, p: ListRecordsParams): RecordItem[] {
  const fields = fieldsByKey(db, p.collectionId)
  const dir = p.sort?.dir === 'asc' ? 'ASC' : 'DESC'
  const key = p.sort?.key ?? 'created_at'
  let orderBy: string
  const bind: (string | number)[] = [p.collectionId]
  if (key === 'title') orderBy = `title COLLATE NOCASE ${dir}`
  else if (key === 'created_at' || key === 'updated_at') orderBy = `${key} ${dir}`
  else if (fields.has(key)) {
    // Empty values always sort last.
    orderBy = `json_extract(data, ?) IS NULL, json_extract(data, ?) ${dir}`
  } else orderBy = `created_at ${dir}`
  let where = 'collection_id = ? AND deleted_at IS NULL'
  const text = p.text?.trim().toLowerCase()
  if (text) {
    where += ' AND (instr(lower(title), ?) > 0 OR instr(lower(body), ?) > 0 OR instr(lower(data), ?) > 0)'
    bind.push(text, text, text)
  }
  if (fields.has(key) && key !== 'title') bind.push(`$."${key}"`, `$."${key}"`)
  bind.push(p.limit ?? 500)
  return db
    .selectObjects(
      `SELECT * FROM records WHERE ${where} ORDER BY ${orderBy}, created_at DESC LIMIT ?`,
      bind,
    )
    .map(recordFromRow)
}

/** Builds a safe FTS5 query: every word must match, as a prefix. */
export function ftsQuery(text: string): string | null {
  const terms = text.match(/[\p{L}\p{N}]+/gu)
  if (!terms?.length) return null
  return terms.map((t) => `"${t}"*`).join(' ')
}

export function search(db: Database, p: { query: string; limit?: number }): SearchHit[] {
  const q = ftsQuery(p.query)
  if (!q) return []
  return db
    .selectObjects(
      `SELECT r.id, r.title, r.collection_id, c.kind, c.name, c.icon,
              snippet(records_fts, 1, '', '', '…', 12) AS snippet
       FROM records_fts
       JOIN records r ON r.rowid = records_fts.rowid
       JOIN collections c ON c.id = r.collection_id
       WHERE records_fts MATCH ? AND r.deleted_at IS NULL AND c.archived_at IS NULL
       ORDER BY rank
       LIMIT ?`,
      [q, p.limit ?? 50],
    )
    .map((r) => ({
      id: String(r.id),
      collectionId: String(r.collection_id),
      collectionKind: String(r.kind) as CollectionKind,
      collectionName: String(r.name),
      collectionIcon: String(r.icon),
      title: String(r.title),
      snippet: String(r.snippet ?? ''),
    }))
}
