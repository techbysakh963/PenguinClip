import type { ClipboardItem, ClipboardCategory } from '../types/clipboard'

const URL_REGEX = /^(?:https?|ftp):\/\/[^\s]+$/i
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}){1,2}$/i
const RGB_COLOR_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/
const CODE_INDICATORS =
  /[{}[\]();].*[{}[\]();]|^(import |export |const |let |var |function |class |def |fn |pub |if \(|for \(|while \(|<\/?[a-z][\s\S]*>)/im

export function detectCategory(item: ClipboardItem): ClipboardCategory {
  if (item.content.type === 'Image') return 'Image'

  const text =
    item.content.type === 'Text'
      ? item.content.data
      : item.content.type === 'RichText'
        ? item.content.data.plain
        : ''

  const trimmed = text.trim()
  if (!trimmed) return 'Text'

  if (URL_REGEX.test(trimmed)) return 'URL'
  if (EMAIL_REGEX.test(trimmed)) return 'Email'
  if (HEX_COLOR_REGEX.test(trimmed) || RGB_COLOR_REGEX.test(trimmed)) return 'Color'
  if (PHONE_REGEX.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7) return 'Phone'
  if (CODE_INDICATORS.test(trimmed)) return 'Code'

  return 'Text'
}

export const CATEGORY_CONFIG: Record<
  ClipboardCategory,
  { label: string; color: string; darkColor: string }
> = {
  URL: { label: 'URL', color: 'bg-blue-100 text-blue-700', darkColor: 'bg-blue-500/20 text-blue-400' },
  Email: { label: 'Email', color: 'bg-purple-100 text-purple-700', darkColor: 'bg-purple-500/20 text-purple-400' },
  Color: { label: 'Color', color: 'bg-pink-100 text-pink-700', darkColor: 'bg-pink-500/20 text-pink-400' },
  Code: { label: 'Code', color: 'bg-green-100 text-green-700', darkColor: 'bg-green-500/20 text-green-400' },
  Phone: { label: 'Phone', color: 'bg-orange-100 text-orange-700', darkColor: 'bg-orange-500/20 text-orange-400' },
  Image: { label: 'Image', color: 'bg-cyan-100 text-cyan-700', darkColor: 'bg-cyan-500/20 text-cyan-400' },
  Text: { label: 'Text', color: 'bg-gray-100 text-gray-600', darkColor: 'bg-gray-500/20 text-gray-400' },
}
