import type { ClipboardItem } from '../types/clipboard'

/** Date-range buckets the clipboard list can be grouped into, in display order.
 * "Pinned" is a special bucket that ignores age and always sits on top. */
export type TimeGroupLabel = 'Pinned' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Older'

/** A non-empty run of items sharing a timeline bucket. */
export interface TimeGroup {
  label: TimeGroupLabel
  items: ClipboardItem[]
}

const DAY_MS = 86_400_000

// Bucket order for the age-based groups (pinned is handled separately).
const AGE_LABELS: TimeGroupLabel[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older']

/** Local midnight of `now` — the boundary between "today" and "yesterday". */
function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function ageLabel(timestamp: string, startOfToday: number): TimeGroupLabel {
  const ts = new Date(timestamp).getTime()
  if (ts >= startOfToday) return 'Today'
  if (ts >= startOfToday - DAY_MS) return 'Yesterday'
  if (ts >= startOfToday - 7 * DAY_MS) return 'Last 7 Days'
  if (ts >= startOfToday - 30 * DAY_MS) return 'Last 30 Days'
  return 'Older'
}

/**
 * Partition a clipboard history into timeline buckets for the grouped view.
 *
 * Pinned items are pulled into a leading "Pinned" group so they keep their
 * prominence regardless of age; everything else is bucketed by how long ago it
 * was copied. Input order is preserved within every bucket, and empty buckets
 * are dropped so callers only render headers that have content.
 */
export function groupHistoryByTime(items: ClipboardItem[], now: Date = new Date()): TimeGroup[] {
  const startOfToday = startOfDay(now)

  const buckets = new Map<TimeGroupLabel, ClipboardItem[]>()
  const push = (label: TimeGroupLabel, item: ClipboardItem) => {
    const existing = buckets.get(label)
    if (existing) existing.push(item)
    else buckets.set(label, [item])
  }

  for (const item of items) {
    push(item.pinned ? 'Pinned' : ageLabel(item.timestamp, startOfToday), item)
  }

  const ordered: TimeGroupLabel[] = ['Pinned', ...AGE_LABELS]
  return ordered
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }))
}
