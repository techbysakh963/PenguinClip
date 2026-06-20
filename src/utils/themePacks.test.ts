import { describe, it, expect } from 'vitest'
import { THEME_PACKS, getThemePack, DEFAULT_THEME_ID, type Palette } from './themePacks'
import { buildThemeCss } from './applyTheme'

const PALETTE_KEYS: (keyof Palette)[] = [
  'bgPrimary',
  'bgSecondary',
  'bgTertiary',
  'bgCard',
  'bgCardHover',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textDisabled',
  'border',
  'borderSubtle',
  'surface0',
  'surface1',
  'surface2',
  'surface3',
  'surfaceBorder',
  'surfaceBorderStrong',
  'glassBg',
]

describe('THEME_PACKS integrity', () => {
  it('includes the default theme', () => {
    expect(THEME_PACKS.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true)
  })

  it('has unique ids', () => {
    const ids = THEME_PACKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('defines every palette token for both light and dark in every theme', () => {
    for (const theme of THEME_PACKS) {
      for (const mode of ['light', 'dark'] as const) {
        for (const key of PALETTE_KEYS) {
          expect(theme[mode][key], `${theme.id}.${mode}.${key}`).toBeTruthy()
        }
      }
    }
  })
})

describe('getThemePack', () => {
  it('falls back to the default for an unknown id', () => {
    expect(getThemePack('does-not-exist').id).toBe(DEFAULT_THEME_ID)
  })
})

describe('buildThemeCss', () => {
  it('puts light surfaces on :root and dark surfaces on :root.dark', () => {
    const css = buildThemeCss(getThemePack('modern'))
    expect(css).toContain(':root{')
    expect(css).toContain('--surface-0:#f3f3f3') // modern light surface
    expect(css).toContain(':root.dark{')
    expect(css).toContain('--surface-0:#1f1f1f') // modern dark surface
  })

  it('emits both the dark (win11) and light (win11Light) palette vars', () => {
    const css = buildThemeCss(getThemePack('modern'))
    expect(css).toContain('--w-text-primary:#ffffff')
    expect(css).toContain('--wl-text-primary:#1a1a1a')
  })

  it('switches the font stack to monospace for the terminal theme', () => {
    expect(buildThemeCss(getThemePack('terminal'))).toContain('--font-ui:"JetBrains Mono"')
    expect(buildThemeCss(getThemePack('modern'))).toContain('--font-ui:"Inter Variable"')
  })

  it('applies the theme corner radii', () => {
    // terminal uses sharp [2, 3]px corners
    const css = buildThemeCss(getThemePack('terminal'))
    expect(css).toContain('--w-radius:2px')
    expect(css).toContain('--w-radius-lg:3px')
  })
})
