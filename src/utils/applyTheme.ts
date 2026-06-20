/**
 * Theme application.
 *
 * A theme is applied by overriding CSS custom properties, so no component code
 * branches on the theme name. The override lives in a single managed <style>
 * element: light palette + light surfaces on :root, dark surfaces on :root.dark
 * (so the existing Light/Dark/System toggle still picks the mode). Layout flags
 * (font, glass) ride along as :root data-attributes. Accent is intentionally
 * left untouched — it stays an independent user overlay (see applyAppearance).
 */
import { type Palette, type ThemePack, getThemePack, DEFAULT_THEME_ID } from './themePacks'

const STORAGE_KEY = 'penguinclip-theme'
const STYLE_ELEMENT_ID = 'penguinclip-theme-vars'

const MONO_STACK =
  '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", "Roboto Mono", ui-monospace, monospace'
const UI_STACK = '"Inter Variable", "Inter", "Segoe UI Variable", system-ui, sans-serif'

/** The win11 (dark-class) custom properties a palette feeds. */
function darkPaletteVars(p: Palette): string {
  return [
    `--w-bg-primary:${p.bgPrimary}`,
    `--w-bg-secondary:${p.bgSecondary}`,
    `--w-bg-tertiary:${p.bgTertiary}`,
    `--w-bg-card:${p.bgCard}`,
    `--w-bg-card-hover:${p.bgCardHover}`,
    `--w-text-primary:${p.textPrimary}`,
    `--w-text-secondary:${p.textSecondary}`,
    `--w-text-tertiary:${p.textTertiary}`,
    `--w-text-disabled:${p.textDisabled}`,
    `--w-border:${p.border}`,
    `--w-border-subtle:${p.borderSubtle}`,
  ].join(';')
}

/** The win11Light (light-class) custom properties a palette feeds. */
function lightPaletteVars(p: Palette): string {
  return [
    `--wl-bg-primary:${p.bgPrimary}`,
    `--wl-bg-secondary:${p.bgSecondary}`,
    `--wl-bg-tertiary:${p.bgTertiary}`,
    `--wl-bg-card:${p.bgCard}`,
    `--wl-bg-card-hover:${p.bgCardHover}`,
    `--wl-text-primary:${p.textPrimary}`,
    `--wl-text-secondary:${p.textSecondary}`,
    `--wl-border:${p.border}`,
  ].join(';')
}

/** The mode-scoped surface/glass tokens consumed directly by index.css. */
function surfaceVars(p: Palette): string {
  return [
    `--surface-0:${p.surface0}`,
    `--surface-1:${p.surface1}`,
    `--surface-2:${p.surface2}`,
    `--surface-3:${p.surface3}`,
    `--surface-border:${p.surfaceBorder}`,
    `--surface-border-strong:${p.surfaceBorderStrong}`,
    `--glass-bg:${p.glassBg}`,
  ].join(';')
}

/** Build the full stylesheet text that re-skins the app for a theme. Pure. */
export function buildThemeCss(theme: ThemePack): string {
  const [control, card] = theme.layout.radius
  const font = theme.layout.font === 'mono' ? MONO_STACK : UI_STACK

  const rootVars = [
    // win11 dark-class palette (chosen in JS by isDark) — always available.
    darkPaletteVars(theme.dark),
    // win11Light light-class palette.
    lightPaletteVars(theme.light),
    // Light is the default mode, so light surfaces sit on :root.
    surfaceVars(theme.light),
    `--w-radius:${control}px`,
    `--w-radius-lg:${card}px`,
    `--font-ui:${font}`,
  ].join(';')

  return [
    `:root{${rootVars}}`,
    // Dark mode swaps only the surface/glass tokens; the palette vars above are
    // already mode-specific via the win11 vs win11Light class split.
    `:root.dark{${surfaceVars(theme.dark)}}`,
  ].join('\n')
}

function styleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }
  return el
}

/** Apply a theme by id, writing its variables and layout flags onto the page. */
export function applyTheme(themeId: string): void {
  const theme = getThemePack(themeId)
  styleElement().textContent = buildThemeCss(theme)

  const root = document.documentElement
  root.dataset.glass = theme.layout.glass ? 'on' : 'off'
  root.dataset.themeFont = theme.layout.font
  root.dataset.theme = theme.id
}

export function loadThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function saveThemeId(themeId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    /* storage may be unavailable; the in-memory apply still holds this session */
  }
}

/** Apply whatever theme is stored (called on each window's startup). */
export function applyStoredTheme(): void {
  applyTheme(loadThemeId())
}
