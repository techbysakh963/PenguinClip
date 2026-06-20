/**
 * Theme packs — the product's visual identity as DATA, not code.
 *
 * A theme is a pair of colour palettes (light + dark) plus a few layout flags
 * (corner radius, UI font, in-app glass). Applying a theme just overrides CSS
 * custom properties (see applyTheme), so adding a theme never touches component
 * logic. Themes are orthogonal to the Light/Dark/System mode toggle and never
 * set the accent — accent stays an independent user overlay.
 */

/** Every colour token a theme defines, for one mode. */
export interface Palette {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgCard: string
  bgCardHover: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textDisabled: string
  border: string
  borderSubtle: string
  surface0: string
  surface1: string
  surface2: string
  surface3: string
  surfaceBorder: string
  surfaceBorderStrong: string
  glassBg: string
}

export type CornerStyle = 'rounded' | 'square'
export type FontStyle = 'ui' | 'mono'
/** Resting card elevation. */
export type ShadowStyle = 'none' | 'soft' | 'hard' | 'glow'
/** Card outline weight. */
export type BorderStyle = 'none' | 'hairline' | 'solid'
/** What a card does on hover. */
export type HoverStyle = 'lift' | 'glow' | 'invert' | 'none'

export interface ThemeLayout {
  /** Control/card corner radii, in px: [control, card]. */
  radius: [number, number]
  font: FontStyle
  /** Whether in-app frosted glass is used (off → solid surfaces). */
  glass: boolean
  shadow: ShadowStyle
  border: BorderStyle
  hover: HoverStyle
  /** CSS background painted on the window shell (a gradient gives glass surfaces
   * something to refract and makes the whole window distinct); null = flat. */
  backdrop: string | null
  /** List spacing density. Defaults to 'comfortable'. */
  density?: 'comfortable' | 'compact' | 'dense'
  /** Category-icon treatment: 'tile' = colour-tinted square (default), 'mono' =
   * no tile, icon inherits the text colour (austere / terminal look). */
  icon?: 'tile' | 'mono'
  /** Motion feel: 'instant' removes card transitions for a snappy feel. */
  motion?: 'smooth' | 'instant'
}

export interface ThemePack {
  id: string
  label: string
  /** One-line description shown under the swatch in the picker. */
  blurb: string
  layout: ThemeLayout
  light: Palette
  dark: Palette
  /** Intrinsically-dark themes (e.g. Cyberpunk, Terminal): selecting one forces
   * the app into dark mode so the chrome matches. */
  forceDark?: boolean
}

const MONO_RADIUS: [number, number] = [2, 3]

// ── Modern ── the current PenguinClip look; applying it re-asserts defaults.
const modern: ThemePack = {
  id: 'modern',
  label: 'Modern',
  blurb: 'The signature PenguinClip look',
  layout: {
    radius: [11, 14],
    font: 'ui',
    glass: true,
    shadow: 'none',
    border: 'hairline',
    hover: 'lift',
    backdrop: null,
  },
  light: {
    bgPrimary: '#f3f3f3',
    bgSecondary: '#ffffff',
    bgTertiary: '#e5e5e5',
    bgCard: '#ffffff',
    bgCardHover: '#f5f5f5',
    textPrimary: '#1a1a1a',
    textSecondary: '#5c5c5c',
    textTertiary: '#767676',
    textDisabled: '#9e9e9e',
    border: '#e5e5e5',
    borderSubtle: '#ededed',
    surface0: '#f3f3f3',
    surface1: '#ffffff',
    surface2: '#f7f7f8',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.08)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.14)',
    glassBg: 'rgba(243, 243, 243, 0.72)',
  },
  dark: {
    bgPrimary: '#202020',
    bgSecondary: '#2d2d2d',
    bgTertiary: '#383838',
    bgCard: '#2d2d2d',
    bgCardHover: '#3d3d3d',
    textPrimary: '#ffffff',
    textSecondary: '#c5c5c5',
    textTertiary: '#9e9e9e',
    textDisabled: '#6e6e6e',
    border: '#454545',
    borderSubtle: '#3a3a3a',
    surface0: '#1f1f1f',
    surface1: '#2a2a2a',
    surface2: '#323232',
    surface3: '#2d2d2d',
    surfaceBorder: 'rgba(255, 255, 255, 0.07)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.12)',
    glassBg: 'rgba(31, 31, 31, 0.72)',
  },
}

// ── Glass ── deep translucent backdrop with frosted panels and see-through
// cards, so the whole window reads as glass — not just the cards.
const glass: ThemePack = {
  id: 'glass',
  label: 'Glass',
  blurb: 'Translucent, frosted, deep',
  layout: {
    radius: [12, 16],
    font: 'ui',
    glass: true,
    shadow: 'glow',
    border: 'hairline',
    hover: 'glow',
    // Colour blobs over the deep surface give the frosted cards content to
    // refract — the whole point of glass.
    backdrop:
      'radial-gradient(circle at 18% 12%, rgba(122,134,255,0.55), transparent 42%), ' +
      'radial-gradient(circle at 86% 22%, rgba(42,220,180,0.42), transparent 44%), ' +
      'radial-gradient(circle at 62% 98%, rgba(196,92,255,0.48), transparent 50%), ' +
      'var(--surface-0)',
  },
  light: {
    bgPrimary: '#d8e6f6',
    bgSecondary: 'rgba(255, 255, 255, 0.62)',
    bgTertiary: 'rgba(255, 255, 255, 0.45)',
    bgCard: 'rgba(255, 255, 255, 0.55)',
    bgCardHover: 'rgba(255, 255, 255, 0.74)',
    textPrimary: '#11243f',
    textSecondary: '#3b5371',
    textTertiary: '#5d7290',
    textDisabled: '#8fa3bb',
    border: 'rgba(255, 255, 255, 0.65)',
    borderSubtle: 'rgba(255, 255, 255, 0.45)',
    surface0: '#d8e6f6',
    surface1: 'rgba(255, 255, 255, 0.55)',
    surface2: 'rgba(255, 255, 255, 0.42)',
    surface3: 'rgba(255, 255, 255, 0.94)',
    surfaceBorder: 'rgba(255, 255, 255, 0.6)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.78)',
    glassBg: 'rgba(255, 255, 255, 0.5)',
  },
  dark: {
    bgPrimary: '#0d1430',
    bgSecondary: 'rgba(255, 255, 255, 0.08)',
    bgTertiary: 'rgba(255, 255, 255, 0.12)',
    bgCard: 'rgba(255, 255, 255, 0.07)',
    bgCardHover: 'rgba(255, 255, 255, 0.13)',
    textPrimary: '#eef2ff',
    textSecondary: '#bcc5e4',
    textTertiary: '#8b96bd',
    textDisabled: '#5c6790',
    border: 'rgba(255, 255, 255, 0.14)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    surface0: '#0d1430',
    surface1: 'rgba(255, 255, 255, 0.07)',
    surface2: 'rgba(255, 255, 255, 0.12)',
    surface3: 'rgba(22, 30, 62, 0.94)',
    surfaceBorder: 'rgba(255, 255, 255, 0.14)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.24)',
    glassBg: 'rgba(255, 255, 255, 0.1)',
  },
}

// ── Minimal ── flat, low-contrast, near-monochrome; no glass, gentle corners.
const minimal: ThemePack = {
  id: 'minimal',
  label: 'Minimal',
  blurb: 'Flat, calm and low-contrast',
  layout: {
    radius: [6, 8],
    font: 'ui',
    glass: false,
    shadow: 'none',
    border: 'none',
    hover: 'none',
    backdrop: null,
    icon: 'mono',
  },
  light: {
    bgPrimary: '#e9eaec',
    bgSecondary: '#f7f8f9',
    bgTertiary: '#dfe0e3',
    bgCard: '#f7f8f9',
    bgCardHover: '#eeeff1',
    textPrimary: '#2a2c2e',
    textSecondary: '#6b6e72',
    textTertiary: '#8a8d92',
    textDisabled: '#b0b3b8',
    border: '#d8dadd',
    borderSubtle: '#e2e3e6',
    surface0: '#e9eaec',
    surface1: '#f7f8f9',
    surface2: '#eeeff1',
    surface3: '#f7f8f9',
    surfaceBorder: 'rgba(0, 0, 0, 0.08)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.12)',
    glassBg: '#f7f8f9',
  },
  dark: {
    bgPrimary: '#101012',
    bgSecondary: '#1a1a1d',
    bgTertiary: '#222225',
    bgCard: '#1a1a1d',
    bgCardHover: '#232327',
    textPrimary: '#e8e8ea',
    textSecondary: '#9a9aa0',
    textTertiary: '#747479',
    textDisabled: '#54545a',
    border: '#2a2a2e',
    borderSubtle: '#222226',
    surface0: '#101012',
    surface1: '#1a1a1d',
    surface2: '#222225',
    surface3: '#1a1a1d',
    surfaceBorder: 'rgba(255, 255, 255, 0.06)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.10)',
    glassBg: '#1a1a1d',
  },
}

// ── Cyberpunk ── neon magenta & cyan on near-black (always dark).
const cyberpunkPalette: Palette = {
  bgPrimary: '#0a0613', bgSecondary: '#140a26', bgTertiary: '#1d1036', bgCard: '#140a26', bgCardHover: '#1f1140',
  textPrimary: '#f2e9ff', textSecondary: '#36f9ff', textTertiary: '#b16cff', textDisabled: '#6a4a9e',
  border: '#ff2bd6', borderSubtle: '#3a1f5c',
  surface0: '#0a0613', surface1: '#140a26', surface2: '#1d1036', surface3: '#160b2a',
  surfaceBorder: 'rgba(255, 43, 214, 0.35)', surfaceBorderStrong: 'rgba(54, 249, 255, 0.5)', glassBg: '#140a26',
}
const cyberpunk: ThemePack = {
  id: 'cyberpunk',
  label: 'Cyberpunk',
  blurb: 'Neon magenta & cyan',
  layout: {
    radius: [2, 4],
    font: 'ui',
    glass: false,
    shadow: 'glow',
    border: 'solid',
    hover: 'glow',
    backdrop:
      'radial-gradient(circle at 14% 8%, rgba(255,43,214,0.30), transparent 40%), ' +
      'radial-gradient(circle at 88% 16%, rgba(54,249,255,0.26), transparent 42%), ' +
      'radial-gradient(circle at 52% 100%, rgba(150,60,255,0.32), transparent 48%), ' +
      'var(--surface-0)',
    density: 'compact',
    motion: 'instant',
  },
  light: cyberpunkPalette,
  dark: cyberpunkPalette,
  forceDark: true,
}

// ── Terminal ── monospace, sharp corners, phosphor-green on black. Always dark
// regardless of the mode toggle — a light terminal isn't a terminal.
const terminalPalette: Palette = {
  bgPrimary: '#0a0e0a',
  bgSecondary: '#0f140f',
  bgTertiary: '#16201a',
  bgCard: '#0f140f',
  bgCardHover: '#16201a',
  textPrimary: '#3bff8f',
  textSecondary: '#2bd477',
  textTertiary: '#1f9d58',
  textDisabled: '#15683b',
  border: '#1c3326',
  borderSubtle: '#142a1d',
  surface0: '#0a0e0a',
  surface1: '#0f140f',
  surface2: '#16201a',
  surface3: '#0f140f',
  surfaceBorder: 'rgba(59, 255, 143, 0.18)',
  surfaceBorderStrong: 'rgba(59, 255, 143, 0.30)',
  glassBg: '#0f140f',
}
const terminal: ThemePack = {
  id: 'terminal',
  label: 'Terminal',
  blurb: 'Monospace, sharp, phosphor-green',
  layout: {
    radius: MONO_RADIUS,
    font: 'mono',
    glass: false,
    shadow: 'none',
    border: 'solid',
    hover: 'invert',
    backdrop: null,
    density: 'dense',
    icon: 'mono',
    motion: 'instant',
  },
  light: terminalPalette,
  dark: terminalPalette,
  forceDark: true,
}

export const THEME_PACKS: ThemePack[] = [modern, glass, minimal, cyberpunk, terminal]

export const DEFAULT_THEME_ID = 'modern'

export function getThemePack(id: string): ThemePack {
  return THEME_PACKS.find((t) => t.id === id) ?? modern
}
