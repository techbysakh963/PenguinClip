import { describe, it, expect } from 'vitest'
import { buildHighlightSegments } from './highlightMatches'

describe('buildHighlightSegments', () => {
  it('returns a single plain segment when there are no ranges', () => {
    expect(buildHighlightSegments('hello world', [])).toEqual([
      { text: 'hello world', highlighted: false },
    ])
  })

  it('returns nothing for empty text', () => {
    expect(buildHighlightSegments('', [[0, 2]])).toEqual([])
  })

  it('splits a match in the middle into three segments', () => {
    // indices are inclusive: 4..8 of "the quick" is "quick"
    expect(buildHighlightSegments('the quick', [[4, 8]])).toEqual([
      { text: 'the ', highlighted: false },
      { text: 'quick', highlighted: true },
    ])
  })

  it('highlights a match at the start', () => {
    expect(buildHighlightSegments('hello world', [[0, 4]])).toEqual([
      { text: 'hello', highlighted: true },
      { text: ' world', highlighted: false },
    ])
  })

  it('merges overlapping and adjacent ranges', () => {
    expect(buildHighlightSegments('abcdef', [[0, 2], [1, 4]])).toEqual([
      { text: 'abcde', highlighted: true },
      { text: 'f', highlighted: false },
    ])
  })

  it('orders unsorted ranges and emits the gaps between them', () => {
    expect(buildHighlightSegments('abcdef', [[4, 5], [0, 1]])).toEqual([
      { text: 'ab', highlighted: true },
      { text: 'cd', highlighted: false },
      { text: 'ef', highlighted: true },
    ])
  })

  it('clamps ranges that run past the end of the text', () => {
    expect(buildHighlightSegments('abcdef', [[3, 99]])).toEqual([
      { text: 'abc', highlighted: false },
      { text: 'def', highlighted: true },
    ])
  })
})
