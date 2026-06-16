import { clsx } from 'clsx'
import { AlertTriangle, X } from 'lucide-react'

/**
 * A non-blocking, dismissible banner for surfacing actionable diagnostics
 * (e.g. "the history file was corrupted and recovered"). Unlike a transient
 * toast it persists until dismissed, because these messages usually require the
 * user to do something.
 */
export function NotificationBanner({
  message,
  isDark,
  onDismiss,
}: {
  message: string
  isDark: boolean
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className={clsx(
        'mx-3 mt-2 flex items-start gap-2 rounded-win11 px-3 py-2 text-xs',
        isDark
          ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
          : 'bg-amber-500/10 text-amber-800 border border-amber-500/30'
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={clsx(
          'flex-shrink-0 rounded p-0.5 transition-colors',
          isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
