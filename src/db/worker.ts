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
import { api, type ApiName } from '../engine/api'
import { emptyTrash } from '../engine/records'
import { getFeatures, migrate, recordLaunch, runBenchmark } from './core'
import type { DbRequest, DbResponse, InitResult, StorageMode, SystemCalls } from './protocol'

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
  // Housekeeping: items in the trash for more than 30 days are deleted for good.
  try {
    emptyTrash(db, { olderThanDays: 30 })
  } catch {
    // Never block startup on housekeeping.
  }
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

type SystemHandler<K extends keyof SystemCalls> = (
  payload: SystemCalls[K][0],
) => Promise<SystemCalls[K][1]>

const system: { [K in keyof SystemCalls]: SystemHandler<K> } = {
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

async function handle(call: string, payload: unknown): Promise<unknown> {
  if (call in system) {
    return (system[call as keyof SystemCalls] as (p: unknown) => Promise<unknown>)(payload)
  }
  if (call in api) {
    await ensureInit()
    const fn = api[call as ApiName] as (database: Database, p: unknown) => unknown
    return fn(db!, payload ?? {})
  }
  throw new Error(`Unknown database call: ${call}`)
}

ctx.onmessage = async (event) => {
  const { id, call, payload } = event.data
  try {
    const result = await handle(call, payload)
    ctx.postMessage({ id, ok: true, result })
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
