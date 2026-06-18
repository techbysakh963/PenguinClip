import { useCallback, useRef, useState } from 'react'

export type ToastIcon = 'pin' | 'star' | 'trash' | 'check'

export interface Toast {
  id: number
  message: string
  icon?: ToastIcon
  /** Set briefly before removal so the viewport can play an exit animation. */
  leaving?: boolean
}

/**
 * Minimal transient-toast store: push a short confirmation ("Pinned",
 * "Removed"), it auto-dismisses, and at most a few stack at once. Kept
 * deliberately tiny — no provider/context — since only the clipboard shell
 * raises toasts.
 */
export function useToasts(duration = 2200) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    // Mark as leaving so the exit animation can run, then drop it.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const push = useCallback(
    (message: string, icon?: ToastIcon) => {
      const id = ++idRef.current
      // Cap the stack so rapid actions don't flood the screen.
      setToasts((prev) => [...prev.slice(-2), { id, message, icon }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss, duration]
  )

  return { toasts, push, dismiss }
}
