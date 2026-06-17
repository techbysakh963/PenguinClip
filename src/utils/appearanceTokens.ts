/**
 * User-tunable appearance tokens (accent, glass strength, corner roundness).
 *
 * These are intentionally frontend-only: they live in localStorage, which is
 * shared across every window of the same origin (clipboard + settings), and are
 * applied by writing CSS custom properties on :root. That keeps them instant and
 * avoids round-tripping through the Rust settings store for what is purely a
 * visual preference.
 */

export interface AppearanceTokens {
  /** Accent colour as #rrggbb. Drives active states, focus rings, primary actions. */
  accent: string
  /** 0 = subtle blur, 1 = heavily frosted. Maps to the glass blur radius. */
  glassStrength: number
  /** 0 = tight corners, 1 = very rounded. Scales every radius token. */
  roundness: number
}

const STORAGE_KEY = 'penguinclip-appearance'

export const DEFAULT_APPEARANCE: AppearanceTokens = {
  accent: '#0078d4',
  glassStrength: 0.5,
  roundness: 0.5,
}

/** Preset accent swatches offered in Settings. */
export const ACCENT_PRESETS = [
  '#0078d4', // Windows blue (default)
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#22c55e', // green
  '#14b8a6', // teal
] as const

export function loadAppearance(): AppearanceTokens {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt/unavailable storage — fall back to defaults */
  }
  return DEFAULT_APPEARANCE
}

export function saveAppearance(tokens: AppearanceTokens): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    /* storage may be unavailable; the in-memory apply still works this session */
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace('#', '')
  return {
    r: parseInt(v.slice(0, 2), 16) || 0,
    g: parseInt(v.slice(2, 4), 16) || 0,
    b: parseInt(v.slice(4, 6), 16) || 0,
  }
}

/** Mix a colour toward white by `amount` (0..1) for a lighter hover variant. */
function lighten({ r, g, b }: { r: number; g: number; b: number }, amount: number): string {
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/** Write the tokens onto :root so the whole app re-themes immediately. */
export function applyAppearance(tokens: AppearanceTokens): void {
  const root = document.documentElement
  const rgb = hexToRgb(tokens.accent)

  // Accent family
  root.style.setProperty('--accent', tokens.accent)
  root.style.setProperty('--accent-hover', lighten(rgb, 0.12))
  root.style.setProperty('--accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`)
  root.style.setProperty('--accent-ring', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`)

  // Glass blur: 8px (subtle) → 28px (heavy)
  const blur = Math.round(8 + clamp01(tokens.glassStrength) * 20)
  root.style.setProperty('--glass-blur', `${blur}px`)

  // Roundness scales every radius token (0.5× → 1.5× of the design defaults)
  const scale = 0.5 + clamp01(tokens.roundness)
  root.style.setProperty('--radius-window', px(18 * scale))
  root.style.setProperty('--radius-card', px(14 * scale))
  root.style.setProperty('--radius-control', px(11 * scale))
  root.style.setProperty('--radius-menu', px(12 * scale))
  root.style.setProperty('--radius-search', px(16 * scale))
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const px = (n: number) => `${Math.round(n)}px`
