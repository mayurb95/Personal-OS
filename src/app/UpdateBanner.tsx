/**
 * Shows when a new version of the app has downloaded, and applies it on tap.
 * The app never reloads by itself, so an update can't interrupt typing.
 */
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // iOS rarely checks for updates on its own; check whenever the app comes back to the front.
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => undefined)
        }
      }
      document.addEventListener('visibilitychange', check)
      window.setInterval(check, 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 4000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-lg ring-[0.5px] ring-separator"
      >
        <div className="flex-1 text-[15px]">
          {needRefresh ? 'A new version of Personal OS is ready.' : 'Ready to work offline.'}
        </div>
        {needRefresh ? (
          <>
            <button
              type="button"
              className="text-[15px] text-label-2"
              onClick={() => setNeedRefresh(false)}
            >
              Later
            </button>
            <button
              type="button"
              className="rounded-full bg-accent px-3.5 py-1.5 text-[15px] font-semibold text-white"
              onClick={() => updateServiceWorker(true)}
            >
              Update
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-[15px] text-accent"
            onClick={() => setOfflineReady(false)}
          >
            OK
          </button>
        )}
      </div>
    </div>
  )
}
