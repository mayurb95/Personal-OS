/**
 * Phase 0 System check: confirms this device can install the app, run it offline and keep
 * its data. "Copy report" produces text to paste back into the chat with Claude.
 */
import { useCallback, useEffect, useState } from 'react'
import { startup, type StartupResult } from '../app/startup'
import { db } from '../db/client'
import type { BenchmarkResult } from '../db/core'
import {
  deviceKind,
  formatBytes,
  hasOpfs,
  isOfflineReady,
  isStandalone,
  isStoragePersisted,
  requestPersistentStorage,
  safariVersion,
  storageEstimate,
  type StorageEstimateInfo,
} from '../lib/environment'
import { ButtonRow, Row, Section, type Status } from '../ui/List'
import { Screen } from '../ui/Screen'

interface EnvState {
  standalone: boolean
  offlineReady: boolean
  opfs: boolean
  persisted: boolean | null
  estimate: StorageEstimateInfo
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function readEnv(): Promise<EnvState> {
  return {
    standalone: isStandalone(),
    offlineReady: isOfflineReady(),
    opfs: hasOpfs(),
    persisted: await isStoragePersisted(),
    estimate: await storageEstimate(),
  }
}

export function SystemCheckScreen() {
  const [start, setStart] = useState<StartupResult | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [env, setEnv] = useState<EnvState | null>(null)
  const [bench, setBench] = useState<BenchmarkResult | null>(null)
  const [benchBusy, setBenchBusy] = useState(false)
  const [benchError, setBenchError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refreshEnv = useCallback(() => {
    readEnv().then(setEnv, () => undefined)
  }, [])

  useEffect(() => {
    startup().then(
      (result) => {
        setStart(result)
        refreshEnv()
      },
      (error: unknown) => setStartError(error instanceof Error ? error.message : String(error)),
    )
    refreshEnv()
  }, [refreshEnv])

  const requestPersist = async () => {
    await requestPersistentStorage()
    refreshEnv()
  }

  const runSpeedTest = async () => {
    setBenchBusy(true)
    setBenchError(null)
    try {
      setBench(await db().call('benchmark', { rows: 1000 }))
    } catch (error) {
      setBenchError(error instanceof Error ? error.message : String(error))
    } finally {
      setBenchBusy(false)
    }
  }

  const copyReport = async () => {
    const text = buildReport({ start, startError, env, bench })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this report:', text)
    }
  }

  const database = start?.database
  const onDevice = database?.storage === 'opfs'

  return (
    <Screen title="System check" subtitle="Phase 0">
      <Section
        title="App"
        footer={
          env && !env.standalone
            ? 'In Safari, tap Share, then Add to Home Screen, then open Personal OS from its icon.'
            : undefined
        }
      >
        <Row
          label="Installed on Home Screen"
          status={env ? (env.standalone ? 'good' : 'warn') : 'neutral'}
          value={env ? (env.standalone ? 'Yes' : 'No') : '…'}
        />
        <Row
          label="Works offline"
          status={env ? (env.offlineReady ? 'good' : 'warn') : 'neutral'}
          value={env ? (env.offlineReady ? 'Yes' : 'Not yet') : '…'}
          detail={
            env && !env.offlineReady
              ? 'The first visit downloads the app. Close it and open it again.'
              : undefined
          }
        />
        <Row
          label="Version"
          value={`${__APP_VERSION__} · ${__APP_COMMIT__}`}
          detail={`Built ${formatWhen(__BUILD_TIME__)}`}
        />
      </Section>

      <Section
        title="Storage"
        footer="Protected storage makes it much less likely that iOS clears the app's data when the phone runs low on space. Backups to OneDrive arrive in Phase 1."
      >
        <Row
          label="Protected storage"
          status={env ? persistStatus(env.persisted) : 'neutral'}
          value={env ? persistLabel(env.persisted) : '…'}
          action={
            env && env.persisted === false ? (
              <button
                type="button"
                onClick={requestPersist}
                className="rounded-full bg-accent px-3 py-1 text-[15px] font-semibold text-white"
              >
                Request
              </button>
            ) : undefined
          }
        />
        <Row
          label="Private file system"
          status={env ? (env.opfs ? 'good' : 'bad') : 'neutral'}
          value={env ? (env.opfs ? 'Available' : 'Missing') : '…'}
        />
        <Row
          label="Space used"
          value={
            env
              ? `${formatBytes(env.estimate.usedBytes)} of ${formatBytes(env.estimate.quotaBytes)}`
              : '…'
          }
        />
      </Section>

      <Section
        title="Database"
        footer={
          start
            ? 'Close the app fully (swipe it away in the app switcher), then reopen it. The launch count should go up by one.'
            : undefined
        }
      >
        {startError ? (
          <Row label="Could not open the database" status="bad" detail={startError} />
        ) : !database ? (
          <Row label="Opening database…" status="neutral" />
        ) : (
          <>
            <Row
              label="Saved on this device"
              status={onDevice ? 'good' : 'bad'}
              value={onDevice ? 'Yes' : 'No'}
              detail={
                onDevice
                  ? `SQLite ${database.features.sqliteVersion}, opened in ${database.initMs} ms`
                  : `Using temporary memory; nothing will be kept. ${database.storageError ?? ''}`
              }
            />
            <Row
              label="Search and JSON support"
              status={database.features.fts5 && database.features.json ? 'good' : 'bad'}
              value={database.features.fts5 && database.features.json ? 'Yes' : 'Missing'}
            />
            <Row
              label="Launches recorded"
              status={start.launch.count > 1 ? 'good' : 'neutral'}
              value={start.launch.count}
              detail={`First ${formatWhen(start.launch.firstLaunch)} · previous ${formatWhen(
                start.launch.previousLaunch,
              )}`}
            />
          </>
        )}
      </Section>

      <Section
        title="Speed test"
        footer="Writes 1,000 sample records, totals them by category and runs a text search, using temporary tables."
      >
        {bench && (
          <Row
            label={`${bench.rows.toLocaleString('en-IN')} records`}
            status="good"
            detail={`Write ${bench.insertMs} ms · summary ${bench.queryMs} ms · search ${bench.searchMs} ms`}
          />
        )}
        {benchError && <Row label="Speed test failed" status="bad" detail={benchError} />}
        <ButtonRow onClick={runSpeedTest} disabled={benchBusy || !database}>
          {benchBusy ? 'Running…' : bench ? 'Run again' : 'Run speed test'}
        </ButtonRow>
      </Section>

      <Section title="Report" footer="Paste the report into the chat with Claude.">
        <ButtonRow onClick={copyReport}>{copied ? 'Copied' : 'Copy report'}</ButtonRow>
      </Section>
    </Screen>
  )
}

function persistStatus(persisted: boolean | null): Status {
  if (persisted === true) return 'good'
  if (persisted === false) return 'warn'
  return 'neutral'
}

function persistLabel(persisted: boolean | null): string {
  if (persisted === true) return 'Granted'
  if (persisted === false) return 'Not granted'
  return 'Unsupported'
}

function buildReport({
  start,
  startError,
  env,
  bench,
}: {
  start: StartupResult | null
  startError: string | null
  env: EnvState | null
  bench: BenchmarkResult | null
}): string {
  const yn = (value: boolean | null | undefined) =>
    value == null ? 'unknown' : value ? 'yes' : 'no'
  const lines = [
    'Personal OS system check',
    `Version: ${__APP_VERSION__} (${__APP_COMMIT__}), built ${__BUILD_TIME__}`,
    `Device: ${deviceKind()}, Safari ${safariVersion() ?? 'unknown'}`,
    `Installed on Home Screen: ${yn(env?.standalone)}`,
    `Offline ready: ${yn(env?.offlineReady)}`,
    `Protected storage: ${yn(env?.persisted)} (requested at startup: ${yn(start?.persistRequested)})`,
    `Private file system: ${yn(env?.opfs)}`,
    `Space: ${formatBytes(env?.estimate.usedBytes ?? null)} of ${formatBytes(
      env?.estimate.quotaBytes ?? null,
    )}`,
  ]
  if (startError) lines.push(`Database error: ${startError}`)
  if (start) {
    const d = start.database
    lines.push(
      `Database: ${d.storage}${d.storageError ? ` (${d.storageError})` : ''}, SQLite ${
        d.features.sqliteVersion
      }, schema ${d.features.schemaVersion}, opened in ${d.initMs} ms`,
      `FTS5: ${yn(d.features.fts5)}, JSON: ${yn(d.features.json)}`,
      `Launches: ${start.launch.count}, first ${start.launch.firstLaunch}, previous ${
        start.launch.previousLaunch ?? 'none'
      }`,
    )
  }
  if (bench) {
    lines.push(
      `Speed test (${bench.rows} rows): write ${bench.insertMs} ms, summary ${bench.queryMs} ms, search ${bench.searchMs} ms`,
    )
  }
  lines.push(`User agent: ${navigator.userAgent}`)
  return lines.join('\n')
}
