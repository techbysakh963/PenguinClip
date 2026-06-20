import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { clsx } from 'clsx'
import { SearchX } from 'lucide-react'

import type { ClipboardItem, UserSettings } from '../types/clipboard'
import type { TabBarRef } from './TabBar'
import { Header } from './Header'
import { SearchBar } from './common/SearchBar'
import { EmptyState } from './EmptyState'
import { HistoryItem } from './HistoryItem'
import { useHistoryKeyboardNavigation } from '../hooks/useHistoryKeyboardNavigation'
import {
  createHistoryFuse,
  getSearchableText,
  searchHistory,
  regexMatchRanges,
  literalMatchRanges,
} from '../utils/historySearch'
import type { MatchRange } from '../utils/highlightMatches'
import { loadSearchPrefs, matchesTrigger, type SearchPrefs } from '../utils/searchPrefs'
import { groupHistoryByTime } from '../utils/timelineGrouping'
import { ScopeMenu } from './common/ScopeMenu'
import { filterByScope, type SearchScope } from '../utils/searchScopes'

export function ClipboardTab(props: {
  history: ClipboardItem[]
  isLoading: boolean
  isDark: boolean
  tertiaryOpacity: number
  secondaryOpacity: number
  clearHistory: () => void
  deleteItem: (id: string) => void
  togglePin: (id: string) => void
  toggleFavorite: (id: string) => void
  onPaste: (id: string) => void
  settings: UserSettings
  tabBarRef: React.RefObject<TabBarRef | null>
}) {
  const {
    history,
    isLoading,
    isDark,
    tertiaryOpacity,
    secondaryOpacity,
    clearHistory,
    deleteItem,
    togglePin,
    toggleFavorite,
    onPaste,
    settings,
    tabBarRef,
  } = props

  const [searchQuery, setSearchQuery] = useState('')
  const [isRegexMode, setIsRegexMode] = useState(false)
  // Active content-type scope. Resets to "all" whenever search is dismissed or
  // the window is reopened so the list never opens silently pre-filtered.
  const [scope, setScope] = useState<SearchScope>('all')

  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clipboard-history-compact-mode') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('clipboard-history-compact-mode', String(isCompact))
  }, [isCompact])

  // Timeline grouping: opt-in date buckets. Flat list stays the default so the
  // fast path is unchanged for anyone who never turns it on.
  const [isTimeline, setIsTimeline] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clipboard-history-timeline-view') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('clipboard-history-timeline-view', String(isTimeline))
  }, [isTimeline])
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [searchPrefs, setSearchPrefs] = useState<SearchPrefs>(loadSearchPrefs)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // The bar is shown when pinned (alwaysShow) or toggled open.
  const searchVisible = searchPrefs.alwaysShow || isSearchVisible

  // Keep search prefs live when changed from the Settings window.
  useEffect(() => {
    const unlisten = listen<SearchPrefs>('search-prefs-changed', (e) => setSearchPrefs(e.payload))
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // Read current query without re-subscribing the global key listener each keystroke.
  const searchQueryRef = useRef('')
  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  const [focusedIndex, setFocusedIndex] = useState(0)

  // Refs
  const historyItemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Check if a key is a printable character that should trigger search
  const isPrintableKey = useCallback((e: KeyboardEvent): boolean => {
    // Skip if any modifier key is pressed (except Shift for uppercase/symbols)
    if (e.ctrlKey || e.altKey || e.metaKey) return false

    // Skip special keys that are handled elsewhere
    const specialKeys = [
      'Tab',
      'Enter',
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Delete',
      'Backspace',
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'F8',
      'F9',
      'F10',
      'F11',
      'F12',
      'CapsLock',
      'NumLock',
      'ScrollLock',
      'Pause',
      'Insert',
      'PrintScreen',
      'ContextMenu',
      'Shift',
      'Control',
      'Alt',
      'Meta',
    ]
    if (specialKeys.includes(e.key)) return false

    // Accept single printable characters (letters, numbers, symbols)
    return e.key.length === 1
  }, [])

  // Toggle search visibility with Ctrl+F or start typing to filter
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const activeElement = document.activeElement

      // Open/close search with the configured trigger (inert when the bar is pinned).
      if (!searchPrefs.alwaysShow && matchesTrigger(e, searchPrefs.trigger)) {
        e.preventDefault()
        setIsSearchVisible((prev) => {
          const newValue = !prev
          if (!newValue) {
            // Clear search and scope when hiding
            setSearchQuery('')
            setScope('all')
          }
          return newValue
        })
        return
      }

      // Escape clears the query; when not pinned it also closes the bar. When
      // pinned and the query is already empty, let it bubble so the window hides.
      if (e.key.toLowerCase() === 'escape' && (searchPrefs.alwaysShow || isSearchVisible)) {
        if (searchPrefs.alwaysShow) {
          if (searchQueryRef.current) {
            e.preventDefault()
            setSearchQuery('')
          }
          return
        }
        e.preventDefault()
        setIsSearchVisible(false)
        setSearchQuery('')
        setScope('all')
        return
      }

      // Skip instant filtering if focus is on an input element (user is already typing in search)
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return

      // Skip if focus is on a tab button (let tab navigation handle it)
      if (activeElement?.getAttribute('role') === 'tab') return

      // Instant filtering: start typing to activate search
      if (isPrintableKey(e)) {
        e.preventDefault()
        // Show search bar and append the typed character
        if (!isSearchVisible) {
          setIsSearchVisible(true)
          setSearchQuery(e.key)
        } else {
          setSearchQuery((prev) => prev + e.key)
        }
        // Highlight the top hit; focus is set by the isSearchVisible effect.
        setFocusedIndex(0)
      }
    },
    [isSearchVisible, isPrintableKey, searchPrefs]
  )

  // Listen for Ctrl+F
  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus search input when it becomes visible
  useEffect(() => {
    if (isSearchVisible && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchVisible])

  // Reset search when window is shown (app reopened)
  useEffect(() => {
    const resetSearch = () => {
      setIsSearchVisible(false)
      setSearchQuery('')
      setScope('all')
    }
    const unlistenWindowShown = listen('window-shown', resetSearch)
    return () => {
      unlistenWindowShown.then((u) => u())
    }
  }, [])

  // Fuzzy search index, rebuilt only when the history changes so that
  // per-keystroke searching stays fast even with large histories.
  const fuse = useMemo(() => createHistoryFuse(history), [history])

  // Filter history: first by text query (fuzzy or regex), then narrow to the
  // active content-type scope. Both run over the in-memory list so the combined
  // filter stays instant. Alongside the list we collect, per item, the matched
  // character ranges so the rows can highlight why each result matched.
  const { filteredHistory, highlightRanges } = useMemo(() => {
    const ranges = new Map<string, MatchRange[]>()
    let result: ClipboardItem[]

    if (!searchQuery) {
      result = history
    } else if (isRegexMode) {
      // Regex mode is the exact, power-user path. Images have no searchable text
      // and stay excluded from search results.
      let regex: RegExp
      try {
        regex = new RegExp(searchQuery, 'i')
      } catch (err) {
        console.error('Invalid regex pattern in clipboard search query:', searchQuery, err)
        return { filteredHistory: [], highlightRanges: ranges }
      }
      result = history.filter((item) => {
        const text = getSearchableText(item)
        if (!text || !regex.test(text)) return false
        ranges.set(item.id, regexMatchRanges(text, searchQuery))
        return true
      })
    } else {
      // Default: fuzzy search ranks WHICH items match; highlighting paints only
      // the literal typed substrings, so it stays crisp instead of scattering
      // across the single characters a fuzzy match would otherwise light up.
      result = searchHistory(fuse, history, searchQuery)
      for (const item of result) {
        const literal = literalMatchRanges(getSearchableText(item), searchQuery)
        if (literal.length) ranges.set(item.id, literal)
      }
    }

    return { filteredHistory: filterByScope(result, scope), highlightRanges: ranges }
  }, [history, searchQuery, isRegexMode, fuse, scope])

  // Grouped view is only meaningful when browsing; an active search ranks by
  // relevance, so we fall back to the flat ranked list until the query clears.
  const isGrouped = isTimeline && !searchQuery
  const timelineGroups = useMemo(
    () => (isGrouped ? groupHistoryByTime(filteredHistory) : []),
    [isGrouped, filteredHistory]
  )

  // Keyboard navigation. ArrowUp on the first result steps back into the search
  // field (when it's open) so the field ↔ results loop stays unbroken.
  useHistoryKeyboardNavigation({
    activeTab: 'clipboard', // Always 'clipboard' when this component is mounted
    itemsLength: filteredHistory.length,
    focusedIndex,
    setFocusedIndex,
    historyItemRefs,
    tabBarRef,
    onArrowUpAtTop: searchVisible ? () => searchInputRef.current?.focus() : undefined,
  })

  // Keyboard handoff from the search field into the results: ArrowDown moves
  // focus to the first row; Enter pastes the highlighted (top) result.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredHistory.length > 0) {
        setFocusedIndex(0)
        historyItemRefs.current[0]?.focus()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filteredHistory[focusedIndex] ?? filteredHistory[0]
      if (target) onPaste(target.id)
    }
  }

  // Ref for stable access to filtered history in event listener
  const filteredHistoryRef = useRef(filteredHistory)
  useEffect(() => {
    filteredHistoryRef.current = filteredHistory
  }, [filteredHistory])

  useEffect(() => {
    const focusFirstItem = () => {
      setTimeout(() => {
        if (filteredHistoryRef.current.length > 0) {
          setFocusedIndex(0)
          historyItemRefs.current[0]?.focus()
        }
      }, 100)
    }
    const unlistenWindowShown = listen('window-shown', focusFirstItem)
    return () => {
      unlistenWindowShown.then((u) => u())
    }
  }, [])

  // Render one row. `index` is the item's position in the flat filtered list so
  // keyboard focus/refs line up identically in both the flat and grouped views.
  const renderHistoryItem = (item: ClipboardItem, index: number) => (
    <HistoryItem
      key={item.id}
      ref={(el) => {
        historyItemRefs.current[index] = el
      }}
      item={item}
      index={index}
      isFocused={index === focusedIndex}
      onPaste={onPaste}
      onDelete={deleteItem}
      onTogglePin={togglePin}
      onToggleFavorite={toggleFavorite}
      onFocus={() => setFocusedIndex(index)}
      isDark={isDark}
      secondaryOpacity={secondaryOpacity}
      isCompact={isCompact}
      enableSmartActions={settings.enable_smart_actions}
      enableUiPolish={settings.enable_ui_polish}
      highlightRanges={highlightRanges.get(item.id)}
    />
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full select-none">
        <div className="w-6 h-6 border-2 border-win11-bg-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (history.length === 0) {
    return <EmptyState isDark={isDark} />
  }

  return (
    <>
      <Header
        onClearHistory={clearHistory}
        itemCount={filteredHistory.length}
        isDark={isDark}
        tertiaryOpacity={tertiaryOpacity}
        isCompact={isCompact}
        onToggleCompact={() => setIsCompact(!isCompact)}
        isTimeline={isTimeline}
        onToggleTimeline={() => setIsTimeline(!isTimeline)}
      />
      {/* Search Bar — appears when you press Ctrl+F or just start typing. The
          glass field floats over the list and animates in. */}
      {searchVisible && (
        // relative + z-index lifts this above the list so the filter dropdown,
        // which overflows downward over the cards, paints on top of them.
        <div className="animate-in relative z-30 px-3 pb-2 pt-1">
          <SearchBar
            ref={searchInputRef}
            value={searchQuery}
            onChange={(v) => {
              // New query → keep the top hit highlighted / as the Enter target.
              setSearchQuery(v)
              setFocusedIndex(0)
            }}
            isDark={isDark}
            placeholder="Search history..."
            isRegex={isRegexMode}
            onToggleRegex={() => setIsRegexMode(!isRegexMode)}
            onKeyDown={handleSearchKeyDown}
            rightActions={
              <ScopeMenu
                scope={scope}
                onChange={(s) => {
                  setScope(s)
                  setFocusedIndex(0)
                }}
              />
            }
            onClear={() => {
              setSearchQuery('')
              // Keep the bar when it's pinned; otherwise close it and drop the scope.
              if (!searchPrefs.alwaysShow) {
                setIsSearchVisible(false)
                setScope('all')
              }
            }}
          />
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="animate-in flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--surface-2)' }}
          >
            <SearchX
              className={clsx(
                'h-6 w-6',
                isDark ? 'text-win11-text-tertiary' : 'text-win11Light-text-secondary'
              )}
            />
          </div>
          <div>
            <p
              className={clsx(
                'text-sm font-medium',
                isDark ? 'text-win11-text-primary' : 'text-win11Light-text-primary'
              )}
            >
              No matches
            </p>
            <p
              className={clsx(
                'mt-0.5 text-xs',
                isDark ? 'text-win11-text-tertiary' : 'text-win11Light-text-secondary'
              )}
            >
              {searchQuery
                ? `Nothing here matches “${searchQuery}”.`
                : 'No items of this type yet.'}
            </p>
          </div>
        </div>
      ) : isGrouped ? (
        <div className="flex flex-col p-3 pt-0" role="listbox" aria-label="Clipboard history">
          {(() => {
            // Walk a running offset so each item keeps its flat-list index for
            // focus/refs even though it's rendered inside a group.
            let offset = 0
            return timelineGroups.map((groupSection) => {
              const start = offset
              offset += groupSection.items.length
              return (
                <section key={groupSection.label} className="flex flex-col">
                  <div className="timeline-header" role="presentation">
                    <span className="timeline-header__label">{groupSection.label}</span>
                    <span className="timeline-header__count">{groupSection.items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 pb-3">
                    {groupSection.items.map((item, i) => renderHistoryItem(item, start + i))}
                  </div>
                </section>
              )
            })
          })()}
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3" role="listbox" aria-label="Clipboard history">
          {filteredHistory.map((item, index) => renderHistoryItem(item, index))}
        </div>
      )}
    </>
  )
}
