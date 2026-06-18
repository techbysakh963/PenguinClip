import { clsx } from 'clsx'
import { Link, Mail, Palette, Code2, Phone, Image as ImageIcon, Type } from 'lucide-react'
import type { ClipboardCategory } from '../../types/clipboard'

export function getIconSize(effectiveCompact: boolean) {
  return effectiveCompact ? 'w-3 h-3' : 'w-4 h-4'
}

export function getIconContainerClasses(effectiveCompact: boolean) {
  return clsx(
    'flex-shrink-0 rounded-[10px] flex items-center justify-center',
    effectiveCompact ? 'w-6 h-6' : 'w-8 h-8'
  )
}

/** lucide icon per content category, so each card reads its type at a glance. */
export const CATEGORY_ICON: Record<ClipboardCategory, typeof Type> = {
  URL: Link,
  Email: Mail,
  Color: Palette,
  Code: Code2,
  Phone: Phone,
  Image: ImageIcon,
  Text: Type,
}

/** Convert a #rrggbb hex to an rgba() string at the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
