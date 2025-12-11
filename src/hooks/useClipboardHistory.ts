import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import type { ClipboardItem } from '../types/clipboard'

/**
 * Hook for managing clipboard history
 */
export function useClipboardHistory() {
  const [history, setHistory] = useState<ClipboardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial history
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await invoke<ClipboardItem[]>('get_history')
      setHistory(items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      await invoke('clear_history')
      setHistory((prev) => prev.filter((item) => item.pinned))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history')
    }
  }, [])

  // Delete a specific item
  const deleteItem = useCallback(async (id: string) => {
    try {
      await invoke('delete_item', { id })
      setHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }, [])

  // Toggle pin status
  const togglePin = useCallback(async (id: string) => {
    try {
      const updatedItem = await invoke<ClipboardItem>('toggle_pin', { id })
      if (updatedItem) {
        setHistory((prev) => prev.map((item) => (item.id === id ? updatedItem : item)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle pin')
    }
  }, [])

  // Paste an item
  const pasteItem = useCallback(async (id: string) => {
    try {
      await invoke('paste_item', { id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to paste item')
    }
  }, [])

  // Listen for clipboard changes
  useEffect(() => {
    fetchHistory()

    let unlistenChanged: UnlistenFn | undefined
    let unlistenCleared: UnlistenFn | undefined

    const setupListeners = async () => {
      unlistenChanged = await listen<ClipboardItem>('clipboard-changed', (event) => {
        setHistory((prev) => {
          const newItem = event.payload

          // Check if item already exists by id
          if (prev.some((i) => i.id === newItem.id)) {
            return prev
          }

          // Also check for content duplicates in the first few unpinned items
          // This handles race conditions between fetchHistory and events
          const unpinnedItems = prev.filter((i) => !i.pinned)
          const isDuplicate = unpinnedItems.slice(0, 5).some((i) => {
            if (i.content.type === 'Text' && newItem.content.type === 'Text') {
              return i.content.data === newItem.content.data
            }
            return false
          })

          if (isDuplicate) {
            return prev
          }

          // Add new item at the top (after pinned items)
          const pinnedItems = prev.filter((i) => i.pinned)
          return [...pinnedItems, newItem, ...unpinnedItems.slice(0, 49)]
        })
      })

      unlistenCleared = await listen('history-cleared', () => {
        setHistory((prev) => prev.filter((item) => item.pinned))
      })
    }

    setupListeners()

    return () => {
      unlistenChanged?.()
      unlistenCleared?.()
    }
  }, [fetchHistory])

  return {
    history,
    isLoading,
    error,
    fetchHistory,
    clearHistory,
    deleteItem,
    togglePin,
    pasteItem,
  }
}
