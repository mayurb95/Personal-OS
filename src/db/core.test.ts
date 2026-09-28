import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import {
  MIGRATIONS,
  getFeatures,
  getMeta,
  migrate,
  recordLaunch,
  runBenchmark,
  schemaVersion,
  setMeta,
} from './core'

let sqlite3: Sqlite3Static
let db: Database

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

beforeEach(() => {
  db = new sqlite3.oo1.DB(':memory:')
})

describe('migrate', () => {
  it('brings a new database to the latest schema', () => {
    expect(schemaVersion(db)).toBe(0)
    expect(migrate(db)).toBe(MIGRATIONS.length)
  })

  it('is safe to run again', () => {
    migrate(db)
    expect(migrate(db)).toBe(MIGRATIONS.length)
  })

  it('refuses a database from a newer app version', () => {
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
    expect(() => migrate(db)).toThrow(/newer than this app/)
  })
})

describe('app_meta', () => {
  it('stores and overwrites values', () => {
    migrate(db)
    expect(getMeta(db, 'x')).toBeUndefined()
    setMeta(db, 'x', 'one')
    setMeta(db, 'x', 'two')
    expect(getMeta(db, 'x')).toBe('two')
  })
})

describe('recordLaunch', () => {
  it('counts launches and remembers the first and previous ones', () => {
    migrate(db)
    const first = recordLaunch(db, new Date('2026-09-28T10:00:00Z'))
    expect(first).toEqual({
      count: 1,
      firstLaunch: '2026-09-28T10:00:00.000Z',
      previousLaunch: null,
    })
    const second = recordLaunch(db, new Date('2026-09-29T08:30:00Z'))
    expect(second).toEqual({
      count: 2,
      firstLaunch: '2026-09-28T10:00:00.000Z',
      previousLaunch: '2026-09-28T10:00:00.000Z',
    })
  })
})

describe('getFeatures', () => {
  it('reports JSON and full-text search support', () => {
    migrate(db)
    const features = getFeatures(db)
    expect(features.json).toBe(true)
    expect(features.fts5).toBe(true)
    expect(features.schemaVersion).toBe(MIGRATIONS.length)
    expect(features.sqliteVersion).toMatch(/^3\.\d+\.\d+$/)
  })
})

describe('runBenchmark', () => {
  it('writes, queries and searches, then cleans up', () => {
    const result = runBenchmark(db, 200)
    expect(result.rows).toBe(200)
    expect(result.insertMs).toBeGreaterThanOrEqual(0)
    const leftovers = db.selectValue(
      `SELECT count(*) FROM temp.sqlite_master WHERE name LIKE 'bench%'`,
    )
    expect(leftovers).toBe(0)
  })
})
