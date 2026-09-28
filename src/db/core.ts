/**
 * Database logic that does not depend on where the database lives.
 *
 * Everything here takes an open SQLite connection, so the same code runs in the
 * app's Web Worker (database in OPFS) and in unit tests (in-memory database in Node).
 */
import type { Database } from '@sqlite.org/sqlite-wasm'

/**
 * Schema migrations, applied in order. Each entry runs once, inside a transaction,
 * and the schema version is tracked in `PRAGMA user_version`.
 * Never edit a migration that has shipped; add a new one instead.
 */
export const MIGRATIONS: readonly string[] = [
  // 1 — key/value store for app-level facts (launch counter, settings that aren't records).
  `CREATE TABLE app_meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   ) STRICT;`,
]

export function schemaVersion(db: Database): number {
  return Number(db.selectValue('PRAGMA user_version') ?? 0)
}

/** Brings the schema up to date. Returns the resulting schema version. */
export function migrate(db: Database): number {
  const current = schemaVersion(db)
  if (current > MIGRATIONS.length) {
    throw new Error(
      `Database schema version ${current} is newer than this app (${MIGRATIONS.length}). ` +
        'Update the app before opening this data.',
    )
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction((tx) => {
      tx.exec(MIGRATIONS[v]!)
      tx.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
  return schemaVersion(db)
}

export function getMeta(db: Database, key: string): string | undefined {
  const value = db.selectValue('SELECT value FROM app_meta WHERE key = ?', [key])
  return value == null ? undefined : String(value)
}

export function setMeta(db: Database, key: string, value: string): void {
  db.exec({
    sql: `INSERT INTO app_meta (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    bind: [key, value],
  })
}

export interface LaunchInfo {
  /** How many times the app has started on this device, including this launch. */
  count: number
  /** ISO time of the very first launch. */
  firstLaunch: string
  /** ISO time of the launch before this one, if any. */
  previousLaunch: string | null
}

/**
 * Records an app launch. Used by the Phase 0 check: if the count keeps rising after the
 * app is closed and reopened, data saved on the device is surviving restarts.
 */
export function recordLaunch(db: Database, now: Date = new Date()): LaunchInfo {
  return db.transaction((tx) => {
    const iso = now.toISOString()
    const count = Number(getMeta(tx, 'launch.count') ?? '0') + 1
    const firstLaunch = getMeta(tx, 'launch.first') ?? iso
    const previousLaunch = getMeta(tx, 'launch.last') ?? null
    setMeta(tx, 'launch.count', String(count))
    setMeta(tx, 'launch.first', firstLaunch)
    setMeta(tx, 'launch.last', iso)
    return { count, firstLaunch, previousLaunch }
  })
}

export interface DbFeatures {
  sqliteVersion: string
  schemaVersion: number
  json: boolean
  fts5: boolean
}

export function getFeatures(db: Database): DbFeatures {
  const hasOption = (name: string) =>
    Number(
      db.selectValue('SELECT count(*) FROM pragma_compile_options WHERE compile_options = ?', [
        name,
      ]) ?? 0,
    ) > 0
  let json = false
  try {
    json = db.selectValue(`SELECT json_extract('{"a":1}', '$.a')`) === 1
  } catch {
    json = false
  }
  return {
    sqliteVersion: String(db.selectValue('SELECT sqlite_version()')),
    schemaVersion: schemaVersion(db),
    json,
    fts5: hasOption('ENABLE_FTS5'),
  }
}

export interface BenchmarkResult {
  rows: number
  insertMs: number
  queryMs: number
  searchMs: number
}

/**
 * Writes and reads records shaped like the app's real ones (JSON values + full-text index),
 * in temporary tables that disappear afterwards. Gives a feel for how fast this device is.
 */
export function runBenchmark(db: Database, rows = 1000): BenchmarkResult {
  const now = () => performance.now()
  db.exec(`
    DROP TABLE IF EXISTS temp.bench;
    DROP TABLE IF EXISTS temp.bench_fts;
    CREATE TEMP TABLE bench (id INTEGER PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL);
    CREATE VIRTUAL TABLE temp.bench_fts USING fts5(title);
  `)
  try {
    const t0 = now()
    db.transaction((tx) => {
      const insert = tx.prepare('INSERT INTO bench (title, data) VALUES (?, ?)')
      const index = tx.prepare('INSERT INTO bench_fts (rowid, title) VALUES (?, ?)')
      try {
        for (let i = 1; i <= rows; i++) {
          const title = `Record ${i} about ${i % 3 === 0 ? 'tariff orders' : 'weekly review'}`
          const data = JSON.stringify({ amount: i * 10, category: `c${i % 7}`, done: i % 2 === 0 })
          insert.bind([title, data]).stepReset()
          index.bind([i, title]).stepReset()
        }
      } finally {
        insert.finalize()
        index.finalize()
      }
    })
    const t1 = now()
    db.selectObjects(
      `SELECT json_extract(data, '$.category') AS category, sum(json_extract(data, '$.amount')) AS total
       FROM bench WHERE json_extract(data, '$.done') = 1 GROUP BY category`,
    )
    const t2 = now()
    db.selectValues(`SELECT rowid FROM bench_fts WHERE bench_fts MATCH 'tariff' LIMIT 50`)
    const t3 = now()
    return {
      rows,
      insertMs: round(t1 - t0),
      queryMs: round(t2 - t1),
      searchMs: round(t3 - t2),
    }
  } finally {
    db.exec('DROP TABLE IF EXISTS temp.bench; DROP TABLE IF EXISTS temp.bench_fts;')
  }
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10
}
