/**
 * Search-bar preferences (frontend-only, shared across windows via localStorage,
 * live-synced with a tauri 'search-prefs-changed' event — same pattern as the
 * appearance tokens). Kept out of the Rust settings store since it's purely a
 * UI behaviour preference for the clipboard window.
 */

export type SearchTrigger = 'ctrl-f' | 'ctrl-k' | 'slash'

export interface SearchPrefs {
  /** When true the search bar is always visible and the trigger key is inert. */
  alwaysShow: boolean
  /** Which key opens the search bar (ignored when alwaysShow is true). */
  trigger: SearchTrigger
}

const STORAGE_KEY = 'penguinclip-search-prefs'

export const DEFAULT_SEARCH_PREFS: SearchPrefs = {
  alwaysShow: false,
  trigger: 'ctrl-f',
}

export const TRIGGER_LABELS: Record<SearchTrigger, string> = {
  'ctrl-f': 'Ctrl + F',
  'ctrl-k': 'Ctrl + K',
  slash: '/  (slash)',
}

export function loadSearchPrefs(): SearchPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SEARCH_PREFS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_SEARCH_PREFS
}

export function saveSearchPrefs(prefs: SearchPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

/** Does this keydown event match the configured trigger? */
export function matchesTrigger(e: KeyboardEvent, trigger: SearchTrigger): boolean {
  switch (trigger) {
    case 'ctrl-f':
      return e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'f'
    case 'ctrl-k':
      return e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'k'
    case 'slash':
      return !e.ctrlKey && !e.altKey && !e.metaKey && e.key === '/'
  }
}
