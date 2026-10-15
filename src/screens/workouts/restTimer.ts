/**
 * Rest timer and screen wake lock for workouts.
 *
 * The timer counts down to a timestamp, so it stays right when the app is in the
 * background. The end beep is scheduled with Web Audio at the moment the timer starts
 * (inside the tap), because iOS only lets a web app start sound from a tap.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

interface TimerState {
  endsAt: number
  total: number
  label: string
}

const KEY = 'pos.restTimer'
let state: TimerState | null = load()
const listeners = new Set<() => void>()
let audio: AudioContext | null = null
let beep: OscillatorNode[] = []

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as TimerState) : null
    return s && s.endsAt > Date.now() ? s : null
  } catch {
    return null
  }
}

function save(): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the timer still works until the app is closed.
  }
}

function emit(): void {
  save()
  for (const l of listeners) l()
}

function cancelBeep(): void {
  for (const o of beep) {
    try {
      o.stop()
    } catch {
      // Already stopped.
    }
  }
  beep = []
}

function scheduleBeep(inSeconds: number): void {
  cancelBeep()
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    void audio.resume()
    const start = audio.currentTime + Math.max(0, inSeconds)
    // Three short tones.
    beep = [0, 0.25, 0.5].map((offset, i) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      osc.frequency.value = i === 2 ? 1320 : 880
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18)
      osc.connect(gain).connect(audio!.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.2)
      return osc
    })
  } catch {
    // Sound is a nicety; the on-screen timer is enough.
  }
}

/** Call from a tap handler. */
export function startRest(seconds: number, label: string): void {
  if (seconds <= 0) return
  state = { endsAt: Date.now() + seconds * 1000, total: seconds, label }
  scheduleBeep(seconds)
  emit()
}

/** Call from a tap handler. */
export function adjustRest(deltaSeconds: number): void {
  if (!state) return
  const endsAt = Math.max(Date.now() + 1000, state.endsAt + deltaSeconds * 1000)
  state = { ...state, endsAt, total: Math.max(state.total + deltaSeconds, 1) }
  scheduleBeep((endsAt - Date.now()) / 1000)
  emit()
}

export function stopRest(): void {
  state = null
  cancelBeep()
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Seconds left (null when no timer is running), updating several times a second. */
export function useRestTimer(): { left: number | null; total: number; label: string } {
  const s = useSyncExternalStore(subscribe, () => state)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!s) return
    const t = window.setInterval(() => {
      setNow(Date.now())
      if (state && Date.now() >= state.endsAt) stopRest()
    }, 250)
    return () => window.clearInterval(t)
  }, [s])
  if (!s) return { left: null, total: 0, label: '' }
  return { left: Math.max(0, Math.ceil((s.endsAt - now) / 1000)), total: s.total, label: s.label }
}

/** Keeps the screen on while `active` (Safari 18.4+; does nothing on older versions). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (cancelled) void l.release()
          else lock = l
        },
        () => undefined,
      )
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [active])
}
