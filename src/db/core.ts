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

  // 2 — the engine: collections of records with user-defined fields, full-text search,
  //     and habit check-ins.
  `CREATE TABLE collections (
     id          TEXT PRIMARY KEY,
     kind        TEXT NOT NULL DEFAULT 'custom',
     name        TEXT NOT NULL,
     icon        TEXT NOT NULL DEFAULT '📁',
     settings    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
     sort        INTEGER NOT NULL DEFAULT 0,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL,
     archived_at TEXT
   ) STRICT;

   CREATE TABLE fields (
     id            TEXT PRIMARY KEY,
     collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
     key           TEXT NOT NULL,
     name          TEXT NOT NULL,
     type          TEXT NOT NULL,
     options       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(options)),
     sort          INTEGER NOT NULL DEFAULT 0,
     builtin       INTEGER NOT NULL DEFAULT 0,
     hidden        INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL,
     UNIQUE (collection_id, key)
   ) STRICT;

   CREATE TABLE records (
     id            TEXT PRIMARY KEY,
     collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
     title         TEXT NOT NULL DEFAULT '',
     data          TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
     body          TEXT NOT NULL DEFAULT '',
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     deleted_at    TEXT
   ) STRICT;

   CREATE INDEX records_by_collection ON records (collection_id, deleted_at, updated_at);
   CREATE INDEX records_task_due ON records (json_extract(data, '$.due'))
     WHERE collection_id = 'tasks';

   CREATE TABLE habit_logs (
     habit_id   TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
     day        TEXT NOT NULL,
     value      REAL NOT NULL DEFAULT 0,
     skipped    INTEGER NOT NULL DEFAULT 0,
     note       TEXT NOT NULL DEFAULT '',
     updated_at TEXT NOT NULL,
     PRIMARY KEY (habit_id, day)
   ) STRICT, WITHOUT ROWID;

   CREATE VIRTUAL TABLE records_fts USING fts5(
     title, body,
     content = 'records', content_rowid = 'rowid',
     tokenize = 'unicode61 remove_diacritics 2'
   );
   CREATE TRIGGER records_fts_insert AFTER INSERT ON records BEGIN
     INSERT INTO records_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
   END;
   CREATE TRIGGER records_fts_delete AFTER DELETE ON records BEGIN
     INSERT INTO records_fts (records_fts, rowid, title, body)
       VALUES ('delete', old.rowid, old.title, old.body);
   END;
   CREATE TRIGGER records_fts_update AFTER UPDATE OF title, body ON records BEGIN
     INSERT INTO records_fts (records_fts, rowid, title, body)
       VALUES ('delete', old.rowid, old.title, old.body);
     INSERT INTO records_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
   END;`,

  // 3 — built-in Tasks and Habits collections.
  `INSERT INTO collections (id, kind, name, icon, sort, created_at, updated_at) VALUES
     ('tasks',  'tasks',  'Tasks',  '✅', -2, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits', 'habits', 'Habits', '🔁', -1, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

   INSERT INTO fields (id, collection_id, key, name, type, options, sort, builtin, created_at) VALUES
     ('tasks.due',          'tasks', 'due',          'Due date',   'date',        '{}', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.time',         'tasks', 'time',         'Time',       'time',        '{}', 2, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.priority',     'tasks', 'priority',     'Priority',   'priority',    '{}', 3, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.project',      'tasks', 'project',      'Project',    'select',      '{"choices":[]}', 4, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.tags',         'tasks', 'tags',         'Tags',       'multiselect', '{"choices":[]}', 5, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.someday',      'tasks', 'someday',      'Someday',    'checkbox',    '{}', 6, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.done',         'tasks', 'done',         'Done',       'checkbox',    '{}', 7, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.completed_at', 'tasks', 'completed_at', 'Completed',  'datetime',    '{}', 8, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('tasks.recurrence',   'tasks', 'recurrence',   'Repeat',     'json',        '{}', 9, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.kind',        'habits', 'kind',        'Type',       'text',        '{}', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.target',      'habits', 'target',      'Target',     'number',      '{}', 2, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.unit',        'habits', 'unit',        'Unit',       'text',        '{}', 3, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.schedule',    'habits', 'schedule',    'Schedule',   'json',        '{}', 4, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.part_of_day', 'habits', 'part_of_day', 'Time of day','text',        '{}', 5, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('habits.archived',    'habits', 'archived',    'Archived',   'checkbox',    '{}', 6, 1, strftime('%Y-%m-%dT%H:%M:%fZ'));`,
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
