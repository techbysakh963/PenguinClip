import { Trash2, Settings } from 'lucide-react'
import { clsx } from 'clsx'

interface HeaderProps {
  onClearHistory: () => void
  itemCount: number
}

/**
 * Header component with title and action buttons
 */
export function Header({ onClearHistory, itemCount }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3" data-tauri-drag-region>
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold dark:text-win11-text-primary text-win11Light-text-primary">
          Clipboard History
        </h1>
        {itemCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full dark:bg-win11-bg-tertiary bg-win11Light-bg-tertiary dark:text-win11-text-secondary text-win11Light-text-secondary">
            {itemCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Clear history button */}
        <button
          onClick={onClearHistory}
          disabled={itemCount === 0}
          className={clsx(
            'p-2 rounded-md transition-colors',
            'dark:text-win11-text-secondary text-win11Light-text-secondary',
            'hover:dark:bg-win11-bg-tertiary hover:bg-win11Light-bg-tertiary',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Clear all"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Settings button (placeholder for future) */}
        <button
          className={clsx(
            'p-2 rounded-md transition-colors',
            'dark:text-win11-text-secondary text-win11Light-text-secondary',
            'hover:dark:bg-win11-bg-tertiary hover:bg-win11Light-bg-tertiary'
          )}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
