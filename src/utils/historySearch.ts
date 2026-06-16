/**
 * Clipboard history search.
 *
 * Provides fuzzy, relevance-ranked search over clipboard history using Fuse.js.
 * The Fuse index is built from the current history and reused across keystrokes
 * (see callers), so searching stays fast even with large histories.
 */
import Fuse, { IFuseOptions } from 'fuse.js'
import type { ClipboardItem } from '../types/clipboard'

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
