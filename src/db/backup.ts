/**
 * Backup and restore of the whole database as a single SQLite file.
 * Works with any storage mode; the worker decides how to put the restored bytes in place.
 */
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { getMeta, MIGRATIONS, schemaVersion, setMeta } from './core'

export interface BackupSummary {
  tasks: number
  habits: number
  records: number
  workouts: number
  schemaVersion: number
}

export function summarise(db: Database): BackupSummary {
  const count = (sql: string) => {
    try {
      return Number(db.selectValue(sql) ?? 0)
    } catch {
      return 0
    }
  }
  return {
    tasks: count(`SELECT count(*) FROM records WHERE collection_id = 'tasks' AND deleted_at IS NULL`),
    habits: count(`SELECT count(*) FROM records WHERE collection_id = 'habits' AND deleted_at IS NULL`),
    records: count(`SELECT count(*) FROM records WHERE deleted_at IS NULL`),
    workouts: count(`SELECT count(*) FROM workout_sessions`),
    schemaVersion: schemaVersion(db),
  }
}

/** Copies the open database into a byte array (a complete .sqlite3 file). */
export function exportBytes(sqlite3: Sqlite3Static, db: Database): Uint8Array {
  return sqlite3.capi.sqlite3_js_db_export(db)
}

/** Opens bytes as a temporary in-memory database. The caller must close it. */
export function openBytes(sqlite3: Sqlite3Static, bytes: Uint8Array): Database {
  const header = new TextDecoder().decode(bytes.subarray(0, 15))
  if (header !== 'SQLite format 3') throw new Error('This file isn’t a Personal OS backup.')
  const db = new sqlite3.oo1.DB(':memory:')
  const pointer = sqlite3.wasm.allocFromTypedArray(bytes)
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer!,
    'main',
    pointer,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  )
  if (rc !== 0) {
    db.close()
    throw new Error('This backup file is damaged and can’t be opened.')
  }
  return db
}

/** Checks a backup before it replaces anything. Returns what it contains. */
export function inspectBackup(sqlite3: Sqlite3Static, bytes: Uint8Array): BackupSummary {
  const db = openBytes(sqlite3, bytes)
  try {
    const ok = db.selectValue(
      `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('app_meta', 'collections', 'records')`,
    )
    if (Number(ok) !== 3) throw new Error('This file isn’t a Personal OS backup.')
    const version = schemaVersion(db)
    if (version > MIGRATIONS.length) {
      throw new Error('This backup comes from a newer version of the app. Update the app first.')
    }
    const integrity = String(db.selectValue('PRAGMA quick_check') ?? '')
    if (integrity !== 'ok') throw new Error('This backup file is damaged and can’t be restored.')
    return summarise(db)
  } finally {
    db.close()
  }
}

export function markBackedUp(db: Database, when: Date = new Date()): void {
  setMeta(db, 'backup.last', when.toISOString())
}

export function lastBackup(db: Database): string | null {
  return getMeta(db, 'backup.last') ?? null
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `personal-os-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(
    now.getHours(),
  )}${p(now.getMinutes())}.sqlite3`
}
