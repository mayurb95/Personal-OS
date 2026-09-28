/**
 * Database Web Worker.
 *
 * Owns the only SQLite connection. The database file lives in the browser's Origin
 * Private File System (OPFS) through SQLite's "opfs-sahpool" storage, which works in
 * Safari without special server headers. If OPFS is unavailable (for example, the app is
 * already open in another tab), it falls back to a temporary in-memory database and
 * reports why, so the app can warn instead of silently losing data.
 */
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { getFeatures, migrate, recordLaunch, runBenchmark } from './core'
import type { DbCallName, DbCalls, DbRequest, DbResponse, InitResult, StorageMode } from './protocol'

// Typed view of the worker global, so this file can share the DOM-based tsconfig.
const ctx = self as unknown as {
  postMessage(message: DbResponse): void
  onmessage: ((event: MessageEvent<DbRequest>) => void) | null
}

const DB_FILE = '/personal-os.sqlite3'

let initPromise: Promise<InitResult> | null = null
let db: Database | null = null

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

async function init(): Promise<InitResult> {
  const started = performance.now()
  const sqlite3 = await sqlite3InitModule()
  let storage: StorageMode = 'opfs'
  let storageError: string | null = null
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({
      name: 'personal-os',
      directory: '/personal-os-db',
      initialCapacity: 6,
    })
    db = new pool.OpfsSAHPoolDb(DB_FILE)
  } catch (error) {
    storage = 'memory'
    storageError = describe(error)
    db = new sqlite3.oo1.DB(':memory:')
  }
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  return {
    storage,
    storageError,
    features: getFeatures(db),
    initMs: Math.round(performance.now() - started),
  }
}

function ensureInit(): Promise<InitResult> {
  initPromise ??= init()
  return initPromise
}

type Handler<K extends DbCallName> = (payload: DbCalls[K][0]) => Promise<DbCalls[K][1]>

const handlers: { [K in DbCallName]: Handler<K> } = {
  init: () => ensureInit(),
  recordLaunch: async () => {
    await ensureInit()
    return recordLaunch(db!)
  },
  benchmark: async ({ rows }) => {
    await ensureInit()
    return runBenchmark(db!, rows)
  },
}

ctx.onmessage = async (event) => {
  const { id, call, payload } = event.data
  try {
    const handler = handlers[call] as Handler<DbCallName>
    if (!handler) throw new Error(`Unknown database call: ${call}`)
    const result = await handler(payload as never)
    ctx.postMessage({ id, ok: true, result })
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: describe(error) })
  }
}
