import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { Settings, X } from 'lucide-react'
import { clsx } from 'clsx'

interface DragHandleProps {
  isDark: boolean
}

export function DragHandle({ isDark }: DragHandleProps) {
  const appWindow = getCurrentWindow()

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return
    try {
      await appWindow.startDragging()
    } catch (error) {
      console.warn('Window dragging not available:', error)
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    appWindow.hide()
  }

  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation()
    invoke('show_settings').catch(console.error)
  }

  return (
    <div
      data-tauri-drag-region
      className="relative w-full flex justify-center pt-4 pb-1 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
    >
      <div
        data-tauri-drag-region
        className={clsx(
          'w-10 h-1 rounded-full pointer-events-none',
          isDark ? 'bg-white/20' : 'bg-black/20'
        )}
      />

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 pt-4 z-10">
        <button
          onClick={handleOpenSettings}
          onMouseDown={(e) => e.stopPropagation()}
          className={clsx(
            'p-1 rounded-md cursor-pointer transition-colors',
            isDark
              ? 'text-white/50 hover:text-white/80 hover:bg-white/10'
              : 'text-black/50 hover:text-black/80 hover:bg-black/10'
          )}
          tabIndex={-1}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
          className={clsx(
            'p-1 rounded-md cursor-pointer',
            isDark ? 'text-white/50' : 'text-black/50'
          )}
          tabIndex={-1}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
