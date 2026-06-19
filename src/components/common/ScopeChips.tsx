import { CategoryPill } from '../CategoryPill'
import { SEARCH_SCOPES, type SearchScope } from '../../utils/searchScopes'

interface ScopeChipsProps {
  scope: SearchScope
  onChange: (scope: SearchScope) => void
  isDark: boolean
  opacity: number
}

/**
 * A thin chip row that scopes the list to a single content type. Reuses the
 * accent-aware CategoryPill so the active chip matches the rest of the app, and
 * wraps rather than scrolls so every scope stays reachable in a narrow window.
 */
export function ScopeChips({ scope, onChange, isDark, opacity }: ScopeChipsProps) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="tablist"
      aria-label="Filter clipboard by type"
    >
      {SEARCH_SCOPES.map((def) => (
        <CategoryPill
          key={def.id}
          category={def.label}
          isActive={scope === def.id}
          onClick={() => onChange(def.id)}
          isDark={isDark}
          opacity={opacity}
        />
      ))}
    </div>
  )
}
