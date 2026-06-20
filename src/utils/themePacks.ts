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

export interface ThemeLayout {
  /** Control/card corner radii, in px: [control, card]. */
  radius: [number, number]
  font: FontStyle
  /** Whether in-app frosted glass is used (off → solid surfaces). */
  glass: boolean
}

export interface ThemePack {
  id: string
  label: string
  /** One-line description shown under the swatch in the picker. */
  blurb: string
  layout: ThemeLayout
  light: Palette
  dark: Palette
}

const MONO_RADIUS: [number, number] = [2, 3]

// ── Modern ── the current PenguinClip look; applying it re-asserts defaults.
const modern: ThemePack = {
  id: 'modern',
  label: 'Modern',
  blurb: 'The signature PenguinClip look',
  layout: { radius: [8, 12], font: 'ui', glass: true },
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
  layout: { radius: [10, 16], font: 'ui', glass: true },
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
  layout: { radius: [6, 8], font: 'ui', glass: false },
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

// ── Windows ── crisp Fluent feel: tighter corners, mica-tinted surfaces.
const windows: ThemePack = {
  id: 'windows',
  label: 'Windows',
  blurb: 'Crisp Fluent design',
  layout: { radius: [4, 8], font: 'ui', glass: true },
  light: {
    bgPrimary: '#e7eef7',
    bgSecondary: '#fbfdff',
    bgTertiary: '#dde7f2',
    bgCard: '#fbfdff',
    bgCardHover: '#eef4fc',
    textPrimary: '#16243a',
    textSecondary: '#465468',
    textTertiary: '#6b7588',
    textDisabled: '#9aa3b2',
    border: '#cfdbe9',
    borderSubtle: '#dde6f1',
    surface0: '#e7eef7',
    surface1: '#fbfdff',
    surface2: '#eef4fc',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(20, 60, 120, 0.10)',
    surfaceBorderStrong: 'rgba(20, 60, 120, 0.16)',
    glassBg: 'rgba(231, 238, 247, 0.74)',
  },
  dark: {
    bgPrimary: '#161b24',
    bgSecondary: '#1f2632',
    bgTertiary: '#28313f',
    bgCard: '#1f2632',
    bgCardHover: '#2a3545',
    textPrimary: '#f2f6fc',
    textSecondary: '#b4c0d2',
    textTertiary: '#8593a8',
    textDisabled: '#5c697d',
    border: '#33404f',
    borderSubtle: '#283340',
    surface0: '#161b24',
    surface1: '#1f2632',
    surface2: '#28313f',
    surface3: '#1f2632',
    surfaceBorder: 'rgba(120, 170, 255, 0.10)',
    surfaceBorderStrong: 'rgba(120, 170, 255, 0.16)',
    glassBg: 'rgba(22, 27, 36, 0.74)',
  },
}

// ── GNOME ── Adwaita: soft neutral greys, generous rounded corners.
const gnome: ThemePack = {
  id: 'gnome',
  label: 'GNOME',
  blurb: 'Adwaita-inspired and rounded',
  layout: { radius: [9, 14], font: 'ui', glass: false },
  light: {
    bgPrimary: '#e9e7e4',
    bgSecondary: '#fbfaf9',
    bgTertiary: '#e0ded9',
    bgCard: '#fbfaf9',
    bgCardHover: '#f2f0ed',
    textPrimary: '#2e3436',
    textSecondary: '#5e5c64',
    textTertiary: '#77767b',
    textDisabled: '#9a999e',
    border: '#d7d4cf',
    borderSubtle: '#e2e0db',
    surface0: '#e9e7e4',
    surface1: '#fbfaf9',
    surface2: '#f2f0ed',
    surface3: '#fbfaf9',
    surfaceBorder: 'rgba(0, 0, 0, 0.09)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.14)',
    glassBg: '#fbfaf9',
  },
  dark: {
    bgPrimary: '#1d1d20',
    bgSecondary: '#2b2b30',
    bgTertiary: '#36363c',
    bgCard: '#2b2b30',
    bgCardHover: '#34343a',
    textPrimary: '#ffffff',
    textSecondary: '#c0bfbc',
    textTertiary: '#9a9996',
    textDisabled: '#6e6d6a',
    border: '#3a3a40',
    borderSubtle: '#2e2e34',
    surface0: '#1d1d20',
    surface1: '#2b2b30',
    surface2: '#36363c',
    surface3: '#2b2b30',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.13)',
    glassBg: '#2b2b30',
  },
}

// ── KDE ── Breeze: cool blue-greys, modest corners.
const kde: ThemePack = {
  id: 'kde',
  label: 'KDE',
  blurb: 'Breeze blue-greys',
  layout: { radius: [5, 8], font: 'ui', glass: true },
  light: {
    bgPrimary: '#dfe6ec',
    bgSecondary: '#fbfcfd',
    bgTertiary: '#d3dce4',
    bgCard: '#fbfcfd',
    bgCardHover: '#eaf2fb',
    textPrimary: '#1f2a33',
    textSecondary: '#3f4d59',
    textTertiary: '#647483',
    textDisabled: '#94a3ae',
    border: '#bcc8d2',
    borderSubtle: '#d0dae2',
    surface0: '#dfe6ec',
    surface1: '#fbfcfd',
    surface2: '#eaf2fb',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(30, 60, 90, 0.12)',
    surfaceBorderStrong: 'rgba(30, 60, 90, 0.18)',
    glassBg: 'rgba(223, 230, 236, 0.76)',
  },
  dark: {
    bgPrimary: '#161b1f',
    bgSecondary: '#222a30',
    bgTertiary: '#2b343c',
    bgCard: '#222a30',
    bgCardHover: '#2c373f',
    textPrimary: '#eef3f6',
    textSecondary: '#aebcc6',
    textTertiary: '#7f8c98',
    textDisabled: '#586671',
    border: '#33404a',
    borderSubtle: '#27323a',
    surface0: '#161b1f',
    surface1: '#222a30',
    surface2: '#2b343c',
    surface3: '#222a30',
    surfaceBorder: 'rgba(120, 180, 230, 0.10)',
    surfaceBorderStrong: 'rgba(120, 180, 230, 0.16)',
    glassBg: 'rgba(22, 27, 31, 0.76)',
  },
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
  layout: { radius: MONO_RADIUS, font: 'mono', glass: false },
  light: terminalPalette,
  dark: terminalPalette,
}

export const THEME_PACKS: ThemePack[] = [modern, glass, minimal, windows, gnome, kde, terminal]

export const DEFAULT_THEME_ID = 'modern'

export function getThemePack(id: string): ThemePack {
  return THEME_PACKS.find((t) => t.id === id) ?? modern
}
