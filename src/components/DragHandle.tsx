import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Drag handle component that allows dragging the window
 * Uses both data-tauri-drag-region (for native support) and
 * explicit startDragging() API call for better compatibility
 */
export function DragHandle() {
  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return

    try {
      await getCurrentWindow().startDragging()
    } catch (error) {
      // Dragging may fail on some Wayland compositors
      // The window will still be draggable via the compositor's own mechanisms
      console.warn('Window dragging not available:', error)
    }
  }

  return (
    <div
      data-tauri-drag-region
      className="w-full flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
    >
      <div
        data-tauri-drag-region
        className="w-16 h-1 rounded-full dark:bg-white/20 bg-black/20 pointer-events-none"
      />
    </div>
  )
}
