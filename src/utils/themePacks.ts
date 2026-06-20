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

// ── Minimal ── flat, low-contrast, near-monochrome; no glass, gentle corners.
const minimal: ThemePack = {
  id: 'minimal',
  label: 'Minimal',
  blurb: 'Flat, calm and low-contrast',
  layout: { radius: [6, 8], font: 'ui', glass: false },
  light: {
    bgPrimary: '#fafafa',
    bgSecondary: '#ffffff',
    bgTertiary: '#f0f0f0',
    bgCard: '#ffffff',
    bgCardHover: '#f4f4f4',
    textPrimary: '#222222',
    textSecondary: '#6b6b6b',
    textTertiary: '#8a8a8a',
    textDisabled: '#b0b0b0',
    border: '#ececec',
    borderSubtle: '#f2f2f2',
    surface0: '#fafafa',
    surface1: '#ffffff',
    surface2: '#f4f4f4',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.06)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.10)',
    glassBg: '#ffffff',
  },
  dark: {
    bgPrimary: '#161616',
    bgSecondary: '#1e1e1e',
    bgTertiary: '#262626',
    bgCard: '#1e1e1e',
    bgCardHover: '#272727',
    textPrimary: '#ededed',
    textSecondary: '#a0a0a0',
    textTertiary: '#7d7d7d',
    textDisabled: '#5a5a5a',
    border: '#2c2c2c',
    borderSubtle: '#242424',
    surface0: '#161616',
    surface1: '#1e1e1e',
    surface2: '#262626',
    surface3: '#1e1e1e',
    surfaceBorder: 'rgba(255, 255, 255, 0.06)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.10)',
    glassBg: '#1e1e1e',
  },
}

// ── Windows ── crisp Fluent feel: tighter corners, mica-tinted surfaces.
const windows: ThemePack = {
  id: 'windows',
  label: 'Windows',
  blurb: 'Crisp Fluent design',
  layout: { radius: [4, 8], font: 'ui', glass: true },
  light: {
    bgPrimary: '#f3f3f3',
    bgSecondary: '#fbfbfb',
    bgTertiary: '#eaeaea',
    bgCard: '#fbfbfb',
    bgCardHover: '#f0f4fa',
    textPrimary: '#1b1b1b',
    textSecondary: '#5b5b5b',
    textTertiary: '#767676',
    textDisabled: '#a0a0a0',
    border: '#e1e1e1',
    borderSubtle: '#ececec',
    surface0: '#f3f3f3',
    surface1: '#fbfbfb',
    surface2: '#f4f6f9',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.07)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.12)',
    glassBg: 'rgba(243, 246, 250, 0.72)',
  },
  dark: {
    bgPrimary: '#1c1c1c',
    bgSecondary: '#272727',
    bgTertiary: '#323232',
    bgCard: '#272727',
    bgCardHover: '#323a44',
    textPrimary: '#ffffff',
    textSecondary: '#c8c8c8',
    textTertiary: '#9b9b9b',
    textDisabled: '#6c6c6c',
    border: '#3d3d3d',
    borderSubtle: '#333333',
    surface0: '#1c1c1c',
    surface1: '#272727',
    surface2: '#2f3338',
    surface3: '#2a2a2a',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.13)',
    glassBg: 'rgba(31, 35, 40, 0.72)',
  },
}

// ── GNOME ── Adwaita: soft neutral greys, generous rounded corners.
const gnome: ThemePack = {
  id: 'gnome',
  label: 'GNOME',
  blurb: 'Adwaita-inspired and rounded',
  layout: { radius: [9, 14], font: 'ui', glass: false },
  light: {
    bgPrimary: '#fafafb',
    bgSecondary: '#ffffff',
    bgTertiary: '#ededef',
    bgCard: '#ffffff',
    bgCardHover: '#f2f2f4',
    textPrimary: '#2e3436',
    textSecondary: '#5e5c64',
    textTertiary: '#77767b',
    textDisabled: '#9a999e',
    border: '#e3e3e6',
    borderSubtle: '#ededef',
    surface0: '#fafafb',
    surface1: '#ffffff',
    surface2: '#f2f2f4',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.08)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.13)',
    glassBg: '#ffffff',
  },
  dark: {
    bgPrimary: '#242424',
    bgSecondary: '#303030',
    bgTertiary: '#3a3a3a',
    bgCard: '#303030',
    bgCardHover: '#3b3b3b',
    textPrimary: '#ffffff',
    textSecondary: '#c0bfbc',
    textTertiary: '#9a9996',
    textDisabled: '#6e6d6a',
    border: '#1e1e1e',
    borderSubtle: '#2a2a2a',
    surface0: '#242424',
    surface1: '#303030',
    surface2: '#383838',
    surface3: '#303030',
    surfaceBorder: 'rgba(255, 255, 255, 0.07)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.30)',
    glassBg: '#303030',
  },
}

// ── KDE ── Breeze: cool blue-greys, modest corners.
const kde: ThemePack = {
  id: 'kde',
  label: 'KDE',
  blurb: 'Breeze blue-greys',
  layout: { radius: [5, 8], font: 'ui', glass: true },
  light: {
    bgPrimary: '#eff0f1',
    bgSecondary: '#fcfcfc',
    bgTertiary: '#e3e5e7',
    bgCard: '#fcfcfc',
    bgCardHover: '#eef4fb',
    textPrimary: '#232629',
    textSecondary: '#4d4d4d',
    textTertiary: '#6e7173',
    textDisabled: '#9aa0a4',
    border: '#bdc3c7',
    borderSubtle: '#d6dadd',
    surface0: '#eff0f1',
    surface1: '#fcfcfc',
    surface2: '#f4f5f6',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.10)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.16)',
    glassBg: 'rgba(239, 240, 241, 0.74)',
  },
  dark: {
    bgPrimary: '#1b1e20',
    bgSecondary: '#2a2e32',
    bgTertiary: '#31363b',
    bgCard: '#2a2e32',
    bgCardHover: '#323a42',
    textPrimary: '#fcfcfc',
    textSecondary: '#bdc3c7',
    textTertiary: '#7f8c8d',
    textDisabled: '#5c6669',
    border: '#3b4045',
    borderSubtle: '#31363b',
    surface0: '#1b1e20',
    surface1: '#2a2e32',
    surface2: '#31363b',
    surface3: '#2a2e32',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderStrong: 'rgba(255, 255, 255, 0.14)',
    glassBg: 'rgba(27, 30, 32, 0.74)',
  },
}

// ── Terminal ── monospace, sharp corners, phosphor-green on black (no glass).
const terminal: ThemePack = {
  id: 'terminal',
  label: 'Terminal',
  blurb: 'Monospace, sharp, phosphor-green',
  layout: { radius: MONO_RADIUS, font: 'mono', glass: false },
  light: {
    bgPrimary: '#f7f7f4',
    bgSecondary: '#ffffff',
    bgTertiary: '#eceae3',
    bgCard: '#ffffff',
    bgCardHover: '#f0efe8',
    textPrimary: '#0b3d1f',
    textSecondary: '#2f6b42',
    textTertiary: '#5a8268',
    textDisabled: '#9bb3a4',
    border: '#d8d6cc',
    borderSubtle: '#e6e4da',
    surface0: '#f7f7f4',
    surface1: '#ffffff',
    surface2: '#f0efe8',
    surface3: '#ffffff',
    surfaceBorder: 'rgba(0, 0, 0, 0.10)',
    surfaceBorderStrong: 'rgba(0, 0, 0, 0.16)',
    glassBg: '#ffffff',
  },
  dark: {
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
  },
}

export const THEME_PACKS: ThemePack[] = [modern, minimal, windows, gnome, kde, terminal]

export const DEFAULT_THEME_ID = 'modern'

export function getThemePack(id: string): ThemePack {
  return THEME_PACKS.find((t) => t.id === id) ?? modern
}
