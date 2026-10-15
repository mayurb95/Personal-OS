import { describe, expect, it } from 'vitest'
import { freshDb, getSqlite3 } from '../test/db'
import { createTask } from '../engine/tasks'
import { backupFileName, exportBytes, inspectBackup, lastBackup, markBackedUp, openBytes } from './backup'
import { MIGRATIONS } from './core'

describe('backup', () => {
  it('exports, inspects and reopens a database', async () => {
    const sqlite3 = await getSqlite3()
    const db = await freshDb()
    createTask(db, { title: 'Keep me' })
    const bytes = exportBytes(sqlite3, db)
    const summary = inspectBackup(sqlite3, bytes)
    expect(summary.tasks).toBe(1)
    expect(summary.schemaVersion).toBe(MIGRATIONS.length)
    const copy = openBytes(sqlite3, bytes)
    expect(copy.selectValue(`SELECT title FROM records WHERE collection_id = 'tasks'`)).toBe('Keep me')
    copy.close()
  })

  it('rejects files that are not backups', async () => {
    const sqlite3 = await getSqlite3()
    expect(() => inspectBackup(sqlite3, new TextEncoder().encode('hello world, not sqlite'))).toThrow(/isn’t a Personal OS backup/)
    const other = new sqlite3.oo1.DB(':memory:')
    other.exec('CREATE TABLE x (a)')
    expect(() => inspectBackup(sqlite3, exportBytes(sqlite3, other))).toThrow(/isn’t a Personal OS backup/)
  })

  it('remembers the last backup and names files by date', async () => {
    const db = await freshDb()
    expect(lastBackup(db)).toBeNull()
    markBackedUp(db, new Date('2026-10-15T11:43:00Z'))
    expect(lastBackup(db)).toBe('2026-10-15T11:43:00.000Z')
    expect(backupFileName(new Date(2026, 9, 15, 17, 13))).toBe('personal-os-backup-2026-10-15-1713.sqlite3')
  })
})
