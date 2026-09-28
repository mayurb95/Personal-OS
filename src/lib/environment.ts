/** Facts about how and where the app is running. Browser-only. */

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export function isOffline(): boolean {
  return !navigator.onLine
}

/** True once the service worker controls the page, i.e. the app shell is cached for offline use. */
export function isOfflineReady(): boolean {
  return Boolean(navigator.serviceWorker?.controller)
}

export function hasOpfs(): boolean {
  return typeof navigator.storage?.getDirectory === 'function'
}

export async function isStoragePersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  return navigator.storage.persisted()
}

/** Asks the browser to protect this app's data from automatic clean-up. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  return navigator.storage.persist()
}

export interface StorageEstimateInfo {
  usedBytes: number | null
  quotaBytes: number | null
}

export async function storageEstimate(): Promise<StorageEstimateInfo> {
  if (!navigator.storage?.estimate) return { usedBytes: null, quotaBytes: null }
  const { usage, quota } = await navigator.storage.estimate()
  return { usedBytes: usage ?? null, quotaBytes: quota ?? null }
}

/** Safari's version from the user agent ("Version/26.0"). iOS froze the OS number in the UA. */
export function safariVersion(): string | null {
  return /Version\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? null
}

export function deviceKind(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Other'
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
