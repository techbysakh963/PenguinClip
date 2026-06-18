import { clsx } from 'clsx'
import { Pin, Star, Trash2, Check } from 'lucide-react'
import type { Toast, ToastIcon } from '../hooks/useToasts'

const ICONS: Record<ToastIcon, typeof Pin> = {
  pin: Pin,
  star: Star,
  trash: Trash2,
  check: Check,
}

/**
 * Bottom-centred stack of glass toast pills. Anchored to the (relative) app
 * shell; pointer-events are off on the container so toasts never block the list
 * underneath.
 */
export function ToastViewport({ toasts, isDark }: { toasts: Toast[]; isDark: boolean }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex flex-col items-center gap-2 px-3"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = toast.icon ? ICONS[toast.icon] : null
        return (
          <div
            key={toast.id}
            className={clsx(
              'glass-panel flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium',
              isDark ? 'text-win11-text-primary' : 'text-win11Light-text-primary',
              toast.leaving ? 'toast-leave' : 'toast-enter'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />}
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
