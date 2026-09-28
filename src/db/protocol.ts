/**
 * Messages between the app (main thread) and the database Web Worker.
 * Every request carries an id; the worker answers with the same id.
 */
import type { BenchmarkResult, DbFeatures, LaunchInfo } from './core'

export type StorageMode = 'opfs' | 'memory'

export interface InitResult {
  storage: StorageMode
  /** Why the on-device store could not be used, when storage is 'memory'. */
  storageError: string | null
  features: DbFeatures
  initMs: number
}

/** Request name → [payload, result]. Add new calls here. */
export interface DbCalls {
  init: [undefined, InitResult]
  recordLaunch: [undefined, LaunchInfo]
  benchmark: [{ rows: number }, BenchmarkResult]
}

export type DbCallName = keyof DbCalls

export interface DbRequest<K extends DbCallName = DbCallName> {
  id: number
  call: K
  payload: DbCalls[K][0]
}

export type DbResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
