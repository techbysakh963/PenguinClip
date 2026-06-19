import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ListFilter, Check, List } from 'lucide-react'
import { SEARCH_SCOPES, type SearchScope } from '../../utils/searchScopes'
import { CATEGORY_ICON } from '../HistoryItem/_HistoryItemUtils'
import { CATEGORY_CONFIG } from '../../utils/categoryDetection'

interface ScopeMenuProps {
  scope: SearchScope
  onChange: (scope: SearchScope) => void
}

/**
 * Compact content-type filter that lives next to the regex toggle inside the
 * search bar. The icon button reflects the active filter (accent when not
 * "All"); clicking opens a dropdown of every scope with its category icon.
 */
export function ScopeMenu({ scope, onChange }: ScopeMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const active = SEARCH_SCOPES.find((s) => s.id === scope) ?? SEARCH_SCOPES[0]
  const isFiltered = scope !== 'all'

  // While open, dismiss on an outside click or Escape. Escape is captured so it
  // closes only the menu and never bubbles to the list's "close search" handler.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'p-1 rounded transition-colors duration-150',
          isFiltered
            ? 'text-win11-bg-accent bg-win11-bg-accent/10'
            : 'dark:text-win11-text-secondary text-win11Light-text-secondary hover:dark:bg-win11-bg-card-hover hover:bg-win11Light-bg-card-hover'
        )}
        title={isFiltered ? `Filter: ${active.label}` : 'Filter by type'}
        aria-label="Filter by type"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ListFilter size={14} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Filter clipboard by type"
          className="glass-panel absolute right-0 top-full z-30 mt-1.5 w-40 rounded-xl p-1 animate-in"
        >
          {SEARCH_SCOPES.map((def) => {
            const Icon = def.category ? CATEGORY_ICON[def.category] : List
            const accent = def.category ? CATEGORY_CONFIG[def.category].accent : undefined
            const selected = def.id === scope
            return (
              <button
                key={def.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(def.id)
                  setOpen(false)
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors',
                  selected
                    ? 'text-win11-bg-accent bg-win11-bg-accent/10'
                    : 'dark:text-win11-text-primary text-win11Light-text-primary hover:dark:bg-win11-bg-card-hover hover:bg-win11Light-bg-card-hover'
                )}
              >
                <Icon
                  size={14}
                  className="flex-shrink-0"
                  style={accent && !selected ? { color: accent } : undefined}
                />
                <span className="flex-1 text-left">{def.label}</span>
                {selected && <Check size={13} className="flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
