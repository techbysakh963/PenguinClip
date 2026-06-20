/**
 * User-tunable appearance (accent colour).
 *
 * Frontend-only: stored in localStorage (shared across every window of the same
 * origin) and applied by writing CSS custom properties on :root, so it is
 * instant and doesn't round-trip through the Rust settings store.
 */

export interface AppearanceTokens {
  /** Accent colour as #rrggbb. Drives active states, focus rings, primary actions. */
  accent: string
  /** Round the main window's corners. Off by default (a squared opaque window
   * avoids dark corner triangles on compositors without alpha). */
  roundedCorners?: boolean
}

const STORAGE_KEY = 'penguinclip-appearance'

export const DEFAULT_APPEARANCE: AppearanceTokens = {
  accent: '#0078d4',
  roundedCorners: false,
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

/** Write the accent tokens onto :root so the whole app re-themes immediately. */
export function applyAppearance(tokens: AppearanceTokens): void {
  const root = document.documentElement
  const rgb = hexToRgb(tokens.accent)

  root.style.setProperty('--accent', tokens.accent)
  root.style.setProperty('--accent-hover', lighten(rgb, 0.12))
  root.style.setProperty('--accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`)
  root.style.setProperty('--accent-ring', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`)

  root.dataset.rounded = tokens.roundedCorners ? 'on' : 'off'
}
