/** Small, non-blocking messages at the bottom of the screen ("Task added", errors). */
import { useSyncExternalStore } from 'react'

interface ToastItem {
  id: number
  text: string
  tone: 'info' | 'error'
  action?: { label: string; run: () => void }
}

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function showToast(
  text: string,
  tone: ToastItem['tone'] = 'info',
  action?: ToastItem['action'],
): void {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, text, tone, action }]
  emit()
  window.setTimeout(() => dismiss(id), action ? 5000 : 3000)
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
  if (!items.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-4 py-2.5 text-[15px] shadow-lg ${
            t.tone === 'error' ? 'bg-bad text-white' : 'bg-label text-bg'
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
