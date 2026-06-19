import { describe, it, expect } from 'vitest'
import type { ClipboardItem } from '../types/clipboard'
import { filterByScope, itemMatchesScope, SEARCH_SCOPES } from './searchScopes'

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

const link = text('link', 'https://example.com/page')
const color = text('color', '#ff8800')
const code = text('code', 'const x = () => { return 1 }')
const plain = text('plain', 'just some words')
const pic = image('pic')
const ALL = [link, color, code, plain, pic]

describe('SEARCH_SCOPES', () => {
  it('leads with an unfiltered "All" scope', () => {
    expect(SEARCH_SCOPES[0]).toMatchObject({ id: 'all', category: null })
  })
})

describe('filterByScope', () => {
  it('returns every item for the "all" scope', () => {
    expect(filterByScope(ALL, 'all')).toEqual(ALL)
  })

  it('keeps only URLs for "links"', () => {
    expect(filterByScope(ALL, 'links').map((i) => i.id)).toEqual(['link'])
  })

  it('keeps only colors for "colors"', () => {
    expect(filterByScope(ALL, 'colors').map((i) => i.id)).toEqual(['color'])
  })

  it('keeps only code for "code"', () => {
    expect(filterByScope(ALL, 'code').map((i) => i.id)).toEqual(['code'])
  })

  it('keeps only images for "images"', () => {
    expect(filterByScope(ALL, 'images').map((i) => i.id)).toEqual(['pic'])
  })

  it('keeps plain text for "text" while excluding links, colors, code and images', () => {
    expect(filterByScope(ALL, 'text').map((i) => i.id)).toEqual(['plain'])
  })

  it('preserves input order within a scope', () => {
    const many = [text('a', 'one'), text('b', 'two'), text('c', 'three')]
    expect(filterByScope(many, 'text').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('itemMatchesScope', () => {
  it('matches anything under "all"', () => {
    expect(itemMatchesScope(pic, 'all')).toBe(true)
    expect(itemMatchesScope(plain, 'all')).toBe(true)
  })

  it('matches by detected category otherwise', () => {
    expect(itemMatchesScope(link, 'links')).toBe(true)
    expect(itemMatchesScope(link, 'code')).toBe(false)
  })
})
