/** A run of text that is either part of a search match or not. */
export interface HighlightSegment {
  text: string
  highlighted: boolean
}

/** Inclusive `[start, end]` character range, as produced by Fuse's match indices. */
export type MatchRange = readonly [number, number]

/**
 * Split `text` into alternating plain / highlighted segments given a set of
 * matched character ranges. Ranges may arrive unsorted, overlapping or running
 * past the end of the string; they are normalised (clamped, sorted, merged)
 * first so the output is always a clean left-to-right walk with no gaps.
 */
export function buildHighlightSegments(
  text: string,
  ranges: ReadonlyArray<MatchRange>
): HighlightSegment[] {
  if (!text) return []

  const last = text.length - 1
  const clamped = ranges
    .map(([start, end]) => [Math.max(0, start), Math.min(end, last)] as [number, number])
    .filter(([start, end]) => start <= end)
    .sort((a, b) => a[0] - b[0])

  // Merge overlapping or touching ranges into maximal runs.
  const merged: [number, number][] = []
  for (const [start, end] of clamped) {
    const prev = merged[merged.length - 1]
    if (prev && start <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], end)
    } else {
      merged.push([start, end])
    }
  }

  if (merged.length === 0) return [{ text, highlighted: false }]

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false })
    }
    segments.push({ text: text.slice(start, end + 1), highlighted: true })
    cursor = end + 1
  }
  if (cursor <= last) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }

  return segments
}
