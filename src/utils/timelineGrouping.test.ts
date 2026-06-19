import { describe, it, expect } from 'vitest'
import type { ClipboardItem } from '../types/clipboard'
import { groupHistoryByTime } from './timelineGrouping'

// A fixed reference "now": local noon on June 15, 2024.
const NOW = new Date(2024, 5, 15, 12, 0, 0)

// Build an ISO timestamp `n` whole days before NOW, at local noon so the value
// always lands squarely inside a bucket regardless of the test machine's zone.
function daysAgo(n: number): string {
  return new Date(2024, 5, 15 - n, 12, 0, 0).toISOString()
}

function item(id: string, ts: string, opts: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id,
    content: { type: 'Text', data: id },
    timestamp: ts,
    pinned: false,
    favorited: false,
    preview: id,
    ...opts,
  }
}

function group(items: ClipboardItem[]) {
  return groupHistoryByTime(items, NOW)
}

describe('groupHistoryByTime', () => {
  it('returns no groups for an empty history', () => {
    expect(group([])).toEqual([])
  })

  it('buckets unpinned items by calendar age', () => {
    const history = [
      item('today', daysAgo(0)),
      item('yesterday', daysAgo(1)),
      item('this-week', daysAgo(5)),
      item('this-month', daysAgo(20)),
      item('ancient', daysAgo(90)),
    ]
    expect(group(history).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['today']],
      ['Yesterday', ['yesterday']],
      ['Last 7 Days', ['this-week']],
      ['Last 30 Days', ['this-month']],
      ['Older', ['ancient']],
    ])
  })

  it('omits groups that have no items', () => {
    const history = [item('a', daysAgo(0)), item('b', daysAgo(40))]
    expect(group(history).map((g) => g.label)).toEqual(['Today', 'Older'])
  })

  it('floats pinned items into a Pinned group ahead of the time buckets', () => {
    const history = [
      item('p1', daysAgo(40), { pinned: true }),
      item('p2', daysAgo(0), { pinned: true }),
      item('recent', daysAgo(0)),
    ]
    expect(group(history).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Pinned', ['p1', 'p2']],
      ['Today', ['recent']],
    ])
  })

  it('preserves input order within each bucket', () => {
    const history = [item('first', daysAgo(0)), item('second', daysAgo(0)), item('third', daysAgo(0))]
    expect(group(history)[0].items.map((i) => i.id)).toEqual(['first', 'second', 'third'])
  })

  it('treats the 7-day edge as Last 7 Days and the 30-day edge as Last 30 Days', () => {
    const history = [item('d7', daysAgo(7)), item('d30', daysAgo(30))]
    expect(group(history).map((g) => g.label)).toEqual(['Last 7 Days', 'Last 30 Days'])
  })
})
