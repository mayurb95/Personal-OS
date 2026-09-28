/** Test helper: a fresh, fully migrated in-memory database. */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { migrate } from '../db/core'

let sqlite3: Sqlite3Static | null = null

export async function freshDb(): Promise<Database> {
  sqlite3 ??= await sqlite3InitModule()
  const db = new sqlite3.oo1.DB(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}
