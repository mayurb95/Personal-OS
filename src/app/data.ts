/**
 * React hooks for reading and changing data through the database worker.
 *
 *   const { data } = useDbQuery('listTasks', { list: 'today', today })
 *   await act('setTaskDone', { id, done: true, today })
 *
 * Every query re-runs automatically after any successful change, so screens stay in sync.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { dataVersion, db, onDataChange } from '../db/client'
import type { DbCallName, DbCalls } from '../db/protocol'
import { localDate } from '../engine/dates'
import { showToast } from '../ui/Toast'

type Args<K extends DbCallName> = undefined extends DbCalls[K][0]
  ? [payload?: DbCalls[K][0]]
  : [payload: DbCalls[K][0]]

export interface QueryState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

export function useDbQuery<K extends DbCallName>(
  call: K,
  ...args: Args<K>
): QueryState<DbCalls[K][1]> {
  const version = useSyncExternalStore(onDataChange, dataVersion)
  const [state, setState] = useState<{ data?: DbCalls[K][1]; error: string | null; loading: boolean }>({
    error: null,
    loading: true,
  })
  const [nonce, setNonce] = useState(0)
  const key = JSON.stringify(args[0] ?? null)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const payload = JSON.parse(key) as DbCalls[K][0]
    ;(db().call as (c: K, p?: DbCalls[K][0]) => Promise<DbCalls[K][1]>)(call, payload ?? undefined).then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error: unknown) =>
        !cancelled &&
        setState((s) => ({
          ...s,
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        })),
    )
    return () => {
      cancelled = true
    }
  }, [call, key, version, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}

/** Runs a database call, showing any error as a toast. Returns undefined if it failed. */
export async function act<K extends DbCallName>(
  call: K,
  ...args: Args<K>
): Promise<DbCalls[K][1] | undefined> {
  try {
    return await (db().call as (c: K, p?: DbCalls[K][0]) => Promise<DbCalls[K][1]>)(call, args[0])
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error')
    return undefined
  }
}

/** Today's local date, updating at midnight and when the app returns to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(localDate)
  useEffect(() => {
    const refresh = () => setToday(localDate())
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const timer = window.setTimeout(refresh, midnight.getTime() - now.getTime())
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [today])
  return today
}
