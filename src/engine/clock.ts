/**
 * Current time and new ids for the engine. Tests replace `clock.now` to get fixed timestamps.
 */
export const clock = {
  now: (): Date => new Date(),
}

export function nowISO(): string {
  return clock.now().toISOString()
}

export function newId(): string {
  return crypto.randomUUID()
}
