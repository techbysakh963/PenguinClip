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

/** The mode-agnostic palette + layout variables, as [name, value] pairs.
 * Mode-agnostic because the win11 vs win11Light class split already encodes
 * light/dark, so these are safe to set inline on :root (where they reliably win
 * over any stylesheet, including inline var() references on cards). */
export function paletteVarEntries(theme: ThemePack): [string, string][] {
  const [control, card] = theme.layout.radius
  const font = theme.layout.font === 'mono' ? MONO_STACK : UI_STACK
  const entries: [string, string][] = []
  const push = (chunk: string) => {
    for (const decl of chunk.split(';')) {
      const i = decl.indexOf(':')
      if (i > 0) entries.push([decl.slice(0, i), decl.slice(i + 1)])
    }
  }
  push(darkPaletteVars(theme.dark))
  push(lightPaletteVars(theme.light))
  entries.push(['--w-radius', `${control}px`])
  entries.push(['--w-radius-lg', `${card}px`])
  entries.push(['--font-ui', font])
  return entries
}

/** Build the stylesheet for the mode-specific surface tokens. Pure.
 * Light surfaces sit on :root; dark surfaces on :root.dark, so the existing
 * Light/Dark toggle keeps switching them. (The palette vars are applied inline
 * instead — see applyTheme.) */
export function buildThemeCss(theme: ThemePack): string {
  return [
    `:root{${surfaceVars(theme.light)}}`,
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
  const root = document.documentElement

  // Palette + layout vars go inline on :root so they always win — including for
  // the cards, whose background is an inline `var(--w-bg-card)` style.
  for (const [name, value] of paletteVarEntries(theme)) {
    root.style.setProperty(name, value)
  }

  // Mode-specific surfaces need :root vs :root.dark, which only a stylesheet can
  // express, so they live in a managed <style>.
  styleElement().textContent = buildThemeCss(theme)

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
