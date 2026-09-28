/** A bottom sheet over a dimmed backdrop, like iOS modal sheets. */
import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({
  open,
  onClose,
  title,
  children,
  right,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  right?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[85vh] overflow-y-auto rounded-t-[14px] bg-bg pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center bg-bg px-4 pb-2 pt-3">
          <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-accent">
            Cancel
          </button>
          <div className="text-[17px] font-semibold">{title}</div>
          <div className="justify-self-end">{right}</div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * iOS only shows the keyboard if an input is focused during the tap itself. Call this in a
 * tap handler that opens a sheet; the sheet's input then takes focus and the keyboard stays.
 */
export function primeKeyboard(): void {
  let el = document.getElementById('keyboard-primer') as HTMLInputElement | null
  if (!el) {
    el = document.createElement('input')
    el.id = 'keyboard-primer'
    el.setAttribute('aria-hidden', 'true')
    el.tabIndex = -1
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;height:0;width:0;font-size:17px;border:0;padding:0'
    document.body.appendChild(el)
  }
  el.focus()
}
