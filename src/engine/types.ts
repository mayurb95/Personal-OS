/** Shapes shared by the engine, the worker and the UI. Plain JSON, so they cross the worker boundary. */

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'datetime'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'rating'
  | 'url'
  | 'priority'
  | 'json'

/** Field types a person can add to their own collections (the rest are for built-in modules). */
export const USER_FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'longtext', label: 'Long text' },
  { type: 'number', label: 'Number' },
  { type: 'currency', label: 'Amount (₹)' },
  { type: 'date', label: 'Date' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'select', label: 'Choice' },
  { type: 'multiselect', label: 'Multiple choice' },
  { type: 'rating', label: 'Rating' },
  { type: 'url', label: 'Link' },
]

export interface Choice {
  id: string
  label: string
}

export interface FieldOptions {
  /** select / multiselect */
  choices?: Choice[]
  /** rating */
  max?: number
  /** currency */
  currency?: string
}

export interface Field {
  id: string
  collectionId: string
  key: string
  name: string
  type: FieldType
  options: FieldOptions
  sort: number
  builtin: boolean
  hidden: boolean
}

export type CollectionKind = 'custom' | 'tasks' | 'habits'

export interface ViewSettings {
  layout: 'list' | 'table'
  sort: { key: string; dir: 'asc' | 'desc' }
}

export interface CollectionSettings {
  view?: ViewSettings
}

export interface Collection {
  id: string
  kind: CollectionKind
  name: string
  icon: string
  settings: CollectionSettings
  sort: number
  createdAt: string
  updatedAt: string
  fields: Field[]
}

export interface CollectionSummary {
  id: string
  kind: CollectionKind
  name: string
  icon: string
  recordCount: number
}

export type FieldValue = string | number | boolean | string[] | null | Record<string, unknown>

export type RecordData = Record<string, FieldValue>

export interface RecordItem {
  id: string
  collectionId: string
  title: string
  data: RecordData
  body: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface TrashItem {
  id: string
  title: string
  collectionId: string
  collectionName: string
  collectionIcon: string
  deletedAt: string
}

export interface SearchHit {
  id: string
  collectionId: string
  collectionKind: CollectionKind
  collectionName: string
  collectionIcon: string
  title: string
  snippet: string
}
