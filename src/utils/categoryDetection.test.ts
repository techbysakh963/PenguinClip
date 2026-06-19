import { describe, it, expect } from 'vitest'
import type { ClipboardItem } from '../types/clipboard'
import { detectCategory } from './categoryDetection'

function text(data: string): ClipboardItem {
  return {
    id: data,
    content: { type: 'Text', data },
    timestamp: '2024-01-01T00:00:00Z',
    pinned: false,
    favorited: false,
    preview: data,
  }
}

const image: ClipboardItem = {
  id: 'img',
  content: { type: 'Image', data: { base64: 'AAAA', width: 1, height: 1 } },
  timestamp: '2024-01-01T00:00:00Z',
  pinned: false,
  favorited: false,
  preview: 'Image',
}

describe('detectCategory — existing types still classify', () => {
  it('detects URLs, emails, colors, code, images and plain text', () => {
    expect(detectCategory(text('https://example.com/page'))).toBe('URL')
    expect(detectCategory(text('someone@example.com'))).toBe('Email')
    expect(detectCategory(text('#ff8800'))).toBe('Color')
    expect(detectCategory(text('const x = () => { return 1 }'))).toBe('Code')
    expect(detectCategory(text('just a sentence of words'))).toBe('Text')
    expect(detectCategory(image)).toBe('Image')
  })
})

describe('detectCategory — Phone', () => {
  it('treats a leading + with digits as a phone, even short ones', () => {
    expect(detectCategory(text('+963'))).toBe('Phone')
    expect(detectCategory(text('+963991234567'))).toBe('Phone')
    expect(detectCategory(text('+1 (555) 010-9999'))).toBe('Phone')
  })

  it('treats plain phone-length digit runs as a phone', () => {
    expect(detectCategory(text('0991234567'))).toBe('Phone')
  })

  it('treats separator-formatted numbers as a phone', () => {
    expect(detectCategory(text('555-123-4567'))).toBe('Phone')
  })
})

describe('detectCategory — Number', () => {
  it('classifies raw digit-only strings as numbers', () => {
    expect(detectCategory(text('42'))).toBe('Number')
    expect(detectCategory(text('2024'))).toBe('Number')
    expect(detectCategory(text('12345678'))).toBe('Number')
  })

  it('does not classify anything with non-digit characters as a number', () => {
    expect(detectCategory(text('#42'))).not.toBe('Number')
    expect(detectCategory(text('42px'))).not.toBe('Number')
    expect(detectCategory(text('$1,234.56'))).not.toBe('Number')
    expect(detectCategory(text('1.5'))).not.toBe('Number')
  })
})
