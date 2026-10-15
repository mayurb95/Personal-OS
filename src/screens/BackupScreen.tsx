import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDbQuery } from '../app/data'
import { db } from '../db/client'
import type { BackupSummary } from '../db/backup'
import { formatBytes } from '../lib/environment'
import { saveFile } from '../lib/share'
import { ButtonRow, Row, Section } from '../ui/List'
import { NavBar } from '../ui/NavBar'
import { Page } from '../ui/Screen'
import { showToast } from '../ui/Toast'

function ago(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  const when = new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  if (days === 0) return `Today, ${when.split(', ').at(-1)}`
  if (days === 1) return 'Yesterday'
  return `${days} days ago (${when})`
}

function describe(s: BackupSummary): string {
  const parts = [`${s.tasks} tasks`, `${s.habits} habits`]
  if (s.workouts) parts.push(`${s.workouts} workouts`)
  parts.push(`${s.records} items in total`)
  return parts.join(', ')
}

/**
 * Manual backup: the whole database as one file, saved through the iOS share sheet
 * (Save to Files → OneDrive). Restore replaces everything with a chosen backup file.
 */
export function BackupScreen() {
  const navigate = useNavigate()
  const status = useDbQuery('backupStatus')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ bytes: Uint8Array; name: string; summary: BackupSummary } | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const prepare = async () => {
    setBusy(true)
    try {
      const { bytes, fileName } = await db().call('exportBackup')
      setFile(new File([bytes as BlobPart], fileName, { type: 'application/octet-stream' }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const done = async () => {
    await db().call('markBackedUp')
    setFile(null)
    showToast('Backup saved')
  }

  // Must run straight from the tap: iOS only opens the share sheet during a user gesture.
  const save = () => {
    if (!file) return
    saveFile(file).then(
      (saved) => saved && void done(),
      (error: unknown) => showToast(error instanceof Error ? error.message : String(error), 'error'),
    )
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const summary = await db().call('inspectBackup', { bytes })
      setPending({ bytes, name: f.name, summary })
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setBusy(false)
      if (picker.current) picker.current.value = ''
    }
  }

  const restore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await db().call('restoreBackup', { bytes: pending.bytes })
      setPending(null)
      showToast('Backup restored')
      navigate('/', { replace: true })
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const last = status.data?.last ?? null
  const stale = !last || Date.now() - new Date(last).getTime() > 7 * 86_400_000

  return (
    <Page>
      <NavBar back={{ to: '/more', label: 'More' }} title="Backup" />
      <div className="pt-4" />
      <Section
        title="Back up"
        footer="Saves everything in one file. In the share sheet, tap Save to Files, then choose OneDrive and a folder such as Personal OS. Back up at least once a week."
      >
        <Row label="Last backup" value={ago(last)} status={stale ? 'warn' : 'good'} />
        {status.data && <Row label="On this phone" detail={describe(status.data.summary)} />}
        {!file ? (
          <ButtonRow onClick={prepare} disabled={busy}>
            {busy ? 'Preparing…' : 'Back up now'}
          </ButtonRow>
        ) : (
          <ButtonRow onClick={save}>
            Save backup file ({formatBytes(file.size)})
          </ButtonRow>
        )}
      </Section>

      <Section
        title="Restore"
        footer="Replaces everything on this phone with the contents of a backup file. Use it on a new phone, or if iOS has cleared the app’s data."
      >
        {!pending ? (
          <ButtonRow onClick={() => picker.current?.click()} disabled={busy}>
            Choose backup file…
          </ButtonRow>
        ) : (
          <>
            <Row label={pending.name} detail={`Contains ${describe(pending.summary)}.`} />
            <ButtonRow tone="bad" onClick={restore} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace everything with this backup'}
            </ButtonRow>
            <ButtonRow onClick={() => setPending(null)}>Cancel</ButtonRow>
          </>
        )}
        <input
          ref={picker}
          type="file"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </Section>
    </Page>
  )
}
