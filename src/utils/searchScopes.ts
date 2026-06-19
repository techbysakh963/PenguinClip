import type { ClipboardItem, ClipboardCategory } from '../types/clipboard'
import { detectCategory } from './categoryDetection'

/** A search/browse scope. `all` is the unfiltered default; the rest narrow the
 * list to a single detected content category. */
export type SearchScope =
  | 'all'
  | 'text'
  | 'links'
  | 'email'
  | 'code'
  | 'colors'
  | 'numbers'
  | 'phone'
  | 'images'

export interface ScopeDef {
  id: SearchScope
  label: string
  /** The detected category this scope keeps, or null for the catch-all. */
  category: ClipboardCategory | null
}

/** Ordered scope list shown in the filter menu. Mirrors the detector's
 * categories so scoping reuses the exact same classification that drives the
 * per-card badges. */
export const SEARCH_SCOPES: ScopeDef[] = [
  { id: 'all', label: 'All', category: null },
  { id: 'text', label: 'Text', category: 'Text' },
  { id: 'links', label: 'Links', category: 'URL' },
  { id: 'email', label: 'Email', category: 'Email' },
  { id: 'code', label: 'Code', category: 'Code' },
  { id: 'colors', label: 'Colors', category: 'Color' },
  { id: 'numbers', label: 'Numbers', category: 'Number' },
  { id: 'phone', label: 'Phone', category: 'Phone' },
  { id: 'images', label: 'Images', category: 'Image' },
]

const CATEGORY_BY_SCOPE: Record<SearchScope, ClipboardCategory | null> = Object.fromEntries(
  SEARCH_SCOPES.map((s) => [s.id, s.category])
) as Record<SearchScope, ClipboardCategory | null>

/** True when `item` belongs in `scope` (always true for the `all` catch-all). */
export function itemMatchesScope(item: ClipboardItem, scope: SearchScope): boolean {
  const category = CATEGORY_BY_SCOPE[scope]
  if (category === null) return true
  return detectCategory(item) === category
}

/** Keep only the items belonging to `scope`, preserving input order. */
export function filterByScope(items: ClipboardItem[], scope: SearchScope): ClipboardItem[] {
  if (scope === 'all') return items
  return items.filter((item) => itemMatchesScope(item, scope))
}
