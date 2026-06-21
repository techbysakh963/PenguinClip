/**
 * Clipboard history search.
 *
 * Provides fuzzy, relevance-ranked search over clipboard history using Fuse.js.
 * The Fuse index is built from the current history and reused across keystrokes
 * (see callers), so searching stays fast even with large histories.
 */
import Fuse, { IFuseOptions } from 'fuse.js'
import type { ClipboardItem } from '../types/clipboard'
import type { MatchRange } from './highlightMatches'

/**
 * Returns the text used for searching an item. Images have no searchable text
 * (matching the previous behaviour, where they were excluded from search).
 */
export function getSearchableText(item: ClipboardItem): string {
  if (item.content.type === 'Text') return item.content.data
  if (item.content.type === 'RichText') return item.content.data.plain
  return ''
}

const FUSE_OPTIONS: IFuseOptions<ClipboardItem> = {
  // 0.0 = exact, 1.0 = match anything. 0.4 tolerates small typos while staying
  // relevant for clipboard snippets.
  threshold: 0.4,
  // Match anywhere in the text, not just near the start.
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 1,
  keys: [{ name: 'text', getFn: getSearchableText }],
}

/** Builds a Fuse index over the given history. */
export function createHistoryFuse(history: ClipboardItem[]): Fuse<ClipboardItem> {
  return new Fuse(history, FUSE_OPTIONS)
}

/** A matched item with its Fuse relevance score (0 = perfect, 1 = worst). */
export interface ScoredItem {
  item: ClipboardItem
  score: number
}

// Recency decays with a 3-day half-life; weight keeps recency a nudge, not a
// dominator, so a strong match still beats a weak-but-recent one.
const RECENCY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 3
const RECENCY_WEIGHT = 0.35

/** 1 for a just-copied item, decaying toward 0 as it ages. */
function recencyScore(item: ClipboardItem, now: number): number {
  const age = now - new Date(item.timestamp).getTime()
  if (!Number.isFinite(age) || age <= 0) return 1
  return Math.exp(-age / RECENCY_HALF_LIFE_MS)
}

/**
 * Rank search matches by usefulness, not just fuzzy score: pinned/favorited
 * items float to the top, then matches are ordered by relevance nudged by how
 * recently they were copied. Pure and stable; lower combined value ranks first.
 */
export function rankSearchResults(scored: ScoredItem[], now: number = Date.now()): ClipboardItem[] {
  return scored
    .map((s, index) => ({ ...s, index }))
    .sort((a, b) => {
      const ka = a.item.pinned || a.item.favorited ? 0 : 1
      const kb = b.item.pinned || b.item.favorited ? 0 : 1
      if (ka !== kb) return ka - kb
      const ra = a.score - RECENCY_WEIGHT * recencyScore(a.item, now)
      const rb = b.score - RECENCY_WEIGHT * recencyScore(b.item, now)
      if (ra !== rb) return ra - rb
      return a.index - b.index // stable tie-break
    })
    .map((s) => s.item)
}

/**
 * Fuzzy-searches history, returning matches ranked by relevance + recency, with
 * pinned/favorited first. An empty query returns the full history unchanged
 * (the backend's pinned-then-recency order).
 */
export function searchHistory(
  fuse: Fuse<ClipboardItem>,
  history: ClipboardItem[],
  query: string
): ClipboardItem[] {
  if (!query) return history
  const scored = fuse.search(query).map((r) => ({ item: r.item, score: r.score ?? 1 }))
  return rankSearchResults(scored)
}

/**
 * All inclusive match ranges of a regex `pattern` within `text`, for the
 * power-user regex search path. Invalid patterns and empty matches yield no
 * ranges so highlighting simply does nothing rather than throwing or looping.
 */
export function regexMatchRanges(text: string, pattern: string): MatchRange[] {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'gi')
  } catch {
    return []
  }
  const ranges: MatchRange[] = []
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || match[0].length === 0) continue
    ranges.push([match.index, match.index + match[0].length - 1])
  }
  return ranges
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Inclusive ranges of every literal, case-insensitive occurrence of the query's
 * whitespace-separated terms within `text`. This is the highlight source for
 * the default search: Fuse decides which rows match (fuzzily), but only the
 * actual typed substrings are painted, so highlighting never scatters across
 * coincidental single characters the way raw fuzzy match indices do.
 */
export function literalMatchRanges(text: string, query: string): MatchRange[] {
  const ranges: MatchRange[] = []
  for (const term of query.trim().split(/\s+/)) {
    if (term) ranges.push(...regexMatchRanges(text, escapeRegExp(term)))
  }
  return ranges
}
