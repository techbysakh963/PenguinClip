import type { ClipboardItem, ClipboardCategory } from '../types/clipboard'

const URL_REGEX = /^(?:https?|ftp):\/\/[^\s]+$/i
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}){1,2}$/i
const RGB_COLOR_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i
// Phone vs Number. A leading "+" marks a phone number (even a short country
// code like "+963"). Without a "+", a string reads as a phone when it is built
// only from dialing characters and carries a phone-length digit count. A
// separator (555-123-4567) lets shorter runs qualify; a bare digit run must be
// long enough (0991234567) so short raw numbers stay Numbers instead.
const PHONE_DIAL_CHARS = /^[+(]?[\d\s().-]+$/
const PHONE_SEPARATORS = /[\s().-]/
const PHONE_PLUS_MIN_DIGITS = 3
const PHONE_FORMATTED_MIN_DIGITS = 7
const PHONE_BARE_MIN_DIGITS = 9
const PHONE_MAX_DIGITS = 15
// A "Number" is a raw digit-only string too short to be a phone. Anything with a
// sign, decimal point, separator, currency symbol or unit is excluded so it
// never collides with phone numbers or formatted values.
const NUMBER_REGEX = /^\d+$/
const NUMBER_MAX_DIGITS = PHONE_BARE_MIN_DIGITS - 1
const CODE_INDICATORS =
  /[{}[\]();].*[{}[\]();]|^(import |export |const |let |var |function |class |def |fn |pub |if \(|for \(|while \(|<\/?[a-z][\s\S]*>)/im

function isPhone(trimmed: string): boolean {
  if (!PHONE_DIAL_CHARS.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '').length
  if (digits > PHONE_MAX_DIGITS) return false
  if (trimmed.startsWith('+')) return digits >= PHONE_PLUS_MIN_DIGITS
  const min = PHONE_SEPARATORS.test(trimmed) ? PHONE_FORMATTED_MIN_DIGITS : PHONE_BARE_MIN_DIGITS
  return digits >= min
}

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
  if (isPhone(trimmed)) return 'Phone'
  if (NUMBER_REGEX.test(trimmed) && trimmed.length <= NUMBER_MAX_DIGITS) return 'Number'
  if (CODE_INDICATORS.test(trimmed)) return 'Code'

  return 'Text'
}

// `accent` is the category's signature colour (hex). It drives both the badge
// (above) and the tinted icon container on each card, so content type is
// scannable at a glance.
export const CATEGORY_CONFIG: Record<
  ClipboardCategory,
  { label: string; color: string; darkColor: string; accent: string }
> = {
  URL: { label: 'URL', color: 'bg-blue-100 text-blue-700', darkColor: 'bg-blue-500/20 text-blue-400', accent: '#3b82f6' },
  Email: { label: 'Email', color: 'bg-purple-100 text-purple-700', darkColor: 'bg-purple-500/20 text-purple-400', accent: '#a855f7' },
  Color: { label: 'Color', color: 'bg-pink-100 text-pink-700', darkColor: 'bg-pink-500/20 text-pink-400', accent: '#ec4899' },
  Code: { label: 'Code', color: 'bg-green-100 text-green-700', darkColor: 'bg-green-500/20 text-green-400', accent: '#22c55e' },
  Phone: { label: 'Phone', color: 'bg-orange-100 text-orange-700', darkColor: 'bg-orange-500/20 text-orange-400', accent: '#f97316' },
  Number: { label: 'Number', color: 'bg-indigo-100 text-indigo-700', darkColor: 'bg-indigo-500/20 text-indigo-400', accent: '#6366f1' },
  Image: { label: 'Image', color: 'bg-cyan-100 text-cyan-700', darkColor: 'bg-cyan-500/20 text-cyan-400', accent: '#06b6d4' },
  Text: { label: 'Text', color: 'bg-gray-100 text-gray-600', darkColor: 'bg-gray-500/20 text-gray-400', accent: '#94a3b8' },
}
