import { describe, it, expect } from 'vitest'
import { THEME_PACKS, getThemePack, DEFAULT_THEME_ID, type Palette } from './themePacks'
import { buildThemeCss, paletteVarEntries } from './applyTheme'

function vars(themeId: string): Record<string, string> {
  return Object.fromEntries(paletteVarEntries(getThemePack(themeId)))
}

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

describe('buildThemeCss (mode-specific surfaces)', () => {
  it('puts light surfaces on :root and dark surfaces on :root.dark', () => {
    const css = buildThemeCss(getThemePack('modern'))
    expect(css).toContain(':root{')
    expect(css).toContain('--surface-0:#f3f3f3') // modern light surface
    expect(css).toContain(':root.dark{')
    expect(css).toContain('--surface-0:#1f1f1f') // modern dark surface
  })
})

describe('paletteVarEntries (inline :root vars)', () => {
  it('emits both the dark (win11) and light (win11Light) palette vars', () => {
    const v = vars('modern')
    expect(v['--w-text-primary']).toBe('#ffffff')
    expect(v['--wl-text-primary']).toBe('#1a1a1a')
    expect(v['--w-bg-card']).toBe('#2d2d2d')
  })

  it('switches the font stack to monospace for the terminal theme', () => {
    expect(vars('terminal')['--font-ui']).toContain('JetBrains Mono')
    expect(vars('modern')['--font-ui']).toContain('Inter Variable')
  })

  it('applies the theme corner radii', () => {
    const v = vars('terminal') // sharp [2, 3]px corners
    expect(v['--w-radius']).toBe('2px')
    expect(v['--w-radius-lg']).toBe('3px')
  })
})
