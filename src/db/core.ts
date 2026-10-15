/**
 * Database logic that does not depend on where the database lives.
 *
 * Everything here takes an open SQLite connection, so the same code runs in the
 * app's Web Worker (database in OPFS) and in unit tests (in-memory database in Node).
 */
import type { Database } from '@sqlite.org/sqlite-wasm'
import { SEED_EXERCISES } from '../engine/seed'

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

  // 4 — workouts: exercise library, routines, sessions with sets, body weight.
  `CREATE TABLE exercises (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     kind        TEXT NOT NULL,
     muscle      TEXT NOT NULL DEFAULT '',
     equipment   TEXT NOT NULL DEFAULT '',
     notes       TEXT NOT NULL DEFAULT '',
     builtin     INTEGER NOT NULL DEFAULT 0,
     archived_at TEXT,
     created_at  TEXT NOT NULL
   ) STRICT;

   CREATE TABLE routines (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     notes       TEXT NOT NULL DEFAULT '',
     weekdays    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(weekdays)),
     items       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(items)),
     sort        INTEGER NOT NULL DEFAULT 0,
     archived_at TEXT,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   ) STRICT;

   CREATE TABLE workout_sessions (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     routine_id TEXT REFERENCES routines(id) ON DELETE SET NULL,
     day        TEXT NOT NULL,
     started_at TEXT NOT NULL,
     ended_at   TEXT,
     notes      TEXT NOT NULL DEFAULT ''
   ) STRICT;
   CREATE INDEX workout_sessions_by_day ON workout_sessions (day);

   CREATE TABLE workout_sets (
     id             TEXT PRIMARY KEY,
     session_id     TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
     exercise_id    TEXT NOT NULL REFERENCES exercises(id),
     exercise_order INTEGER NOT NULL,
     set_order      INTEGER NOT NULL,
     weight_kg      REAL,
     reps           INTEGER,
     duration_s     INTEGER,
     distance_m     REAL,
     target_reps    INTEGER,
     rest_s         INTEGER NOT NULL DEFAULT 90,
     done           INTEGER NOT NULL DEFAULT 0,
     created_at     TEXT NOT NULL
   ) STRICT;
   CREATE INDEX workout_sets_by_session ON workout_sets (session_id, exercise_order, set_order);
   CREATE INDEX workout_sets_by_exercise ON workout_sets (exercise_id);

   CREATE TABLE body_weights (
     day        TEXT PRIMARY KEY,
     weight_kg  REAL NOT NULL,
     updated_at TEXT NOT NULL
   ) STRICT, WITHOUT ROWID;

   INSERT INTO exercises (id, name, kind, muscle, equipment, builtin, created_at) VALUES
   ${SEED_EXERCISES.map(
     ([name, kind, muscle, equipment], i) =>
       `('ex-${String(i + 1).padStart(3, '0')}', '${name.replace(/'/g, "''")}', '${kind}', '${muscle}', '${equipment}', 1, strftime('%Y-%m-%dT%H:%M:%fZ'))`,
   ).join(',\n   ')};`,

  // 5 — money: built-in Expenses collection (amounts in INR, original currency kept),
  //     recurring expenses. Budgets live in the collection's settings.
  `INSERT INTO collections (id, kind, name, icon, sort, settings, created_at, updated_at) VALUES
     ('expenses', 'expenses', 'Expenses', '💸', -3, '{"budgets":{}}', strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

   INSERT INTO fields (id, collection_id, key, name, type, options, sort, builtin, created_at) VALUES
     ('expenses.amount',   'expenses', 'amount',   'Amount (₹)', 'currency', '{"currency":"INR"}', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.date',     'expenses', 'date',     'Date',       'date',     '{}', 2, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.category', 'expenses', 'category', 'Category',   'select',   '{"choices": [{"id": "cat-1", "label": "Food & dining"}, {"id": "cat-2", "label": "Groceries"}, {"id": "cat-3", "label": "Transport"}, {"id": "cat-4", "label": "Fuel"}, {"id": "cat-5", "label": "Bills & utilities"}, {"id": "cat-6", "label": "Rent"}, {"id": "cat-7", "label": "Shopping"}, {"id": "cat-8", "label": "Travel"}, {"id": "cat-9", "label": "Health"}, {"id": "cat-10", "label": "Entertainment"}, {"id": "cat-11", "label": "Subscriptions"}, {"id": "cat-12", "label": "Education"}, {"id": "cat-13", "label": "Personal care"}, {"id": "cat-14", "label": "Gifts & donations"}, {"id": "cat-15", "label": "Fees & charges"}, {"id": "cat-16", "label": "Other"}, {"id": "cat-17", "label": "Salary"}, {"id": "cat-18", "label": "Refund"}, {"id": "cat-19", "label": "Interest"}, {"id": "cat-20", "label": "Other income"}]}', 3, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.method',   'expenses', 'method',   'Paid with',  'select',   '{"choices": [{"id": "pay-1", "label": "UPI"}, {"id": "pay-2", "label": "SBI Aurum card"}, {"id": "pay-3", "label": "HDFC Diners card"}, {"id": "pay-4", "label": "Debit card"}, {"id": "pay-5", "label": "Cash"}, {"id": "pay-6", "label": "Bank transfer"}]}', 4, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.type',     'expenses', 'type',     'Type',       'text',     '{}', 5, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.currency', 'expenses', 'currency', 'Currency',   'text',     '{}', 6, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.original_amount', 'expenses', 'original_amount', 'Amount in currency', 'number', '{}', 7, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.rate',     'expenses', 'rate',     'Exchange rate', 'number', '{}', 8, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.recurring_id', 'expenses', 'recurring_id', 'Recurring', 'text', '{}', 9, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('expenses.import_key', 'expenses', 'import_key', 'Import key', 'text', '{}', 10, 1, strftime('%Y-%m-%dT%H:%M:%fZ'));

   CREATE INDEX records_expense_date ON records (json_extract(data, '$.date'))
     WHERE collection_id = 'expenses';

   CREATE TABLE recurring_expenses (
     id         TEXT PRIMARY KEY,
     title      TEXT NOT NULL,
     amount     REAL NOT NULL,
     category   TEXT NOT NULL DEFAULT '',
     method     TEXT NOT NULL DEFAULT '',
     freq       TEXT NOT NULL DEFAULT 'month',
     interval   INTEGER NOT NULL DEFAULT 1,
     next_date  TEXT NOT NULL,
     day_of_month INTEGER,
     active     INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL
   ) STRICT;`,

  // 6 — journal: one entry per day with mood, energy and emotions.
  `INSERT INTO collections (id, kind, name, icon, sort, created_at, updated_at) VALUES
     ('journal', 'journal', 'Journal', '📓', -4, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

   INSERT INTO fields (id, collection_id, key, name, type, options, sort, builtin, created_at) VALUES
     ('journal.day',      'journal', 'day',      'Day',      'date',        '{}', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('journal.mood',     'journal', 'mood',     'Mood',     'rating',      '{"max":5}', 2, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('journal.energy',   'journal', 'energy',   'Energy',   'rating',      '{"max":5}', 3, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('journal.emotions', 'journal', 'emotions', 'Feelings', 'multiselect', '{"choices": [{"id": "emo-1", "label": "Happy"}, {"id": "emo-2", "label": "Calm"}, {"id": "emo-3", "label": "Grateful"}, {"id": "emo-4", "label": "Excited"}, {"id": "emo-5", "label": "Proud"}, {"id": "emo-6", "label": "Focused"}, {"id": "emo-7", "label": "Tired"}, {"id": "emo-8", "label": "Stressed"}, {"id": "emo-9", "label": "Anxious"}, {"id": "emo-10", "label": "Sad"}, {"id": "emo-11", "label": "Frustrated"}, {"id": "emo-12", "label": "Lonely"}]}', 4, 1, strftime('%Y-%m-%dT%H:%M:%fZ')),
     ('journal.prompt',   'journal', 'prompt',   'Prompt',   'text',        '{}', 5, 1, strftime('%Y-%m-%dT%H:%M:%fZ'));

   CREATE UNIQUE INDEX journal_one_per_day ON records (json_extract(data, '$.day'))
     WHERE collection_id = 'journal' AND deleted_at IS NULL;`,
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
