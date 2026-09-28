/**
 * The app's handle on the database worker. Use `db()` anywhere in the UI:
 *
 *   const info = await db().call('init')
 */
import type { DbCallName, DbCalls, DbRequest, DbResponse } from './protocol'

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void }

export class DbClient {
  private worker: Worker
  private pending = new Map<number, Pending>()
  private nextId = 1

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<DbResponse>) => {
      const message = event.data
      const waiting = this.pending.get(message.id)
      if (!waiting) return
      this.pending.delete(message.id)
      if (message.ok) waiting.resolve(message.result)
      else waiting.reject(new Error(message.error))
    }
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'The database worker failed to start.')
      for (const waiting of this.pending.values()) waiting.reject(error)
      this.pending.clear()
    }
  }

  call<K extends DbCallName>(
    call: K,
    ...args: DbCalls[K][0] extends undefined ? [] : [DbCalls[K][0]]
  ): Promise<DbCalls[K][1]> {
    const id = this.nextId++
    const request: DbRequest<K> = { id, call, payload: args[0] as DbCalls[K][0] }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      this.worker.postMessage(request)
    })
  }
}

let client: DbClient | null = null

export function db(): DbClient {
  client ??= new DbClient()
  return client
}
