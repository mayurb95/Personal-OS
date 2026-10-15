import type { ExerciseKind } from '../../engine/workouts'

/** 62.5 → "62.5", 60 → "60". */
export function kg(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(Math.round(v * 100) / 100)
}

export function km(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return ''
  return String(Math.round(meters / 10) / 100)
}

export function volume(v: number): string {
  return `${Math.round(v).toLocaleString('en-IN')} kg`
}

export function minutes(seconds: number): string {
  const m = Math.round(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: 'Weight × reps',
  reps: 'Reps only',
  time: 'Time',
  distance: 'Distance and time',
}

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
