import { describe, it, expect } from 'vitest'
import type { ClipboardItem } from '../types/clipboard'
import { createHistoryFuse, getSearchableText, searchHistory } from './historySearch'

function text(id: string, data: string): ClipboardItem {
  return {
    id,
    content: { type: 'Text', data },
    timestamp: '2024-01-01T00:00:00Z',
    pinned: false,
    favorited: false,
    preview: data,
  }
}

function richText(id: string, plain: string): ClipboardItem {
  return {
    id,
    content: { type: 'RichText', data: { plain, html: `<p>${plain}</p>` } },
    timestamp: '2024-01-01T00:00:00Z',
    pinned: false,
    favorited: false,
    preview: plain,
  }
}

function image(id: string): ClipboardItem {
  return {
    id,
    content: { type: 'Image', data: { base64: 'AAAA', width: 1, height: 1 } },
    timestamp: '2024-01-01T00:00:00Z',
    pinned: false,
    favorited: false,
    preview: 'Image (1x1)',
  }
}

function run(history: ClipboardItem[], query: string): ClipboardItem[] {
  return searchHistory(createHistoryFuse(history), history, query)
}

describe('getSearchableText', () => {
  it('extracts text and rich-text plain, but nothing from images', () => {
    expect(getSearchableText(text('a', 'hello'))).toBe('hello')
    expect(getSearchableText(richText('b', 'world'))).toBe('world')
    expect(getSearchableText(image('c'))).toBe('')
  })
})

describe('searchHistory', () => {
  it('returns the full history unchanged for an empty query', () => {
    const history = [text('a', 'one'), text('b', 'two')]
    expect(run(history, '')).toBe(history)
  })

  it('finds an exact substring match', () => {
    const history = [text('a', 'the quick brown fox'), text('b', 'lorem ipsum')]
    const results = run(history, 'brown')
    expect(results.map((r) => r.id)).toContain('a')
    expect(results.map((r) => r.id)).not.toContain('b')
  })

  it('tolerates typos (fuzzy match)', () => {
    const history = [text('a', 'javascript snippet'), text('b', 'python script')]
    const results = run(history, 'javascrpt')
    expect(results[0]?.id).toBe('a')
  })

  it('ranks a closer match ahead of a looser one', () => {
    const history = [text('a', 'the quick brown fox jumped'), text('b', 'quick')]
    const results = run(history, 'quick')
    expect(results[0]?.id).toBe('b')
  })

  it('excludes images from results', () => {
    const history = [text('a', 'screenshot notes'), image('b')]
    const results = run(history, 'screenshot')
    expect(results.map((r) => r.id)).toEqual(['a'])
  })
})
