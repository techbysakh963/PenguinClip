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
  // Matched character ranges, used to highlight why a result matched.
  includeMatches: true,
  minMatchCharLength: 1,
  keys: [{ name: 'text', getFn: getSearchableText }],
}

/** Builds a Fuse index over the given history. */
export function createHistoryFuse(history: ClipboardItem[]): Fuse<ClipboardItem> {
  return new Fuse(history, FUSE_OPTIONS)
}

/**
 * Fuzzy-searches history, returning matches ordered by relevance. An empty
 * query returns the full history unchanged (recency order preserved).
 */
export function searchHistory(
  fuse: Fuse<ClipboardItem>,
  history: ClipboardItem[],
  query: string
): ClipboardItem[] {
  if (!query) return history
  return fuse.search(query).map((result) => result.item)
}

/** A search result paired with the character ranges that matched the query. */
export interface SearchMatch {
  item: ClipboardItem
  ranges: MatchRange[]
}

/**
 * Like {@link searchHistory} but also returns, for each result, the matched
 * character ranges in its searchable text so callers can highlight them. A
 * single text key is searched, so the ranges come straight from its match.
 */
export function searchHistoryWithMatches(
  fuse: Fuse<ClipboardItem>,
  query: string
): SearchMatch[] {
  if (!query) return []
  return fuse.search(query).map((result) => ({
    item: result.item,
    ranges: (result.matches?.[0]?.indices ?? []).map(([start, end]) => [start, end] as MatchRange),
  }))
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
