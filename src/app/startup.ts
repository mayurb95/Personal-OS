/**
 * Work done once each time the app starts: open the database, record the launch,
 * and (when installed on the Home Screen) ask iOS to keep this app's data.
 * Screens await `startup()` instead of repeating these steps.
 */
import { db } from '../db/client'
import type { LaunchInfo } from '../db/core'
import type { InitResult } from '../db/protocol'
import { isStandalone, requestPersistentStorage } from '../lib/environment'

export interface StartupResult {
  database: InitResult
  launch: LaunchInfo
  /** Result of the persistent-storage request made at startup; null if not attempted. */
  persistRequested: boolean | null
}

let started: Promise<StartupResult> | null = null

async function run(): Promise<StartupResult> {
  const database = await db().call('init')
  const launch = await db().call('recordLaunch')
  // WebKit grants persistence more readily to Home Screen apps, so only ask there.
  const persistRequested = isStandalone() ? await requestPersistentStorage() : null
  return { database, launch, persistRequested }
}

export function startup(): Promise<StartupResult> {
  started ??= run()
  return started
}
