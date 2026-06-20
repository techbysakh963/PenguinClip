export function calculateSecondaryOpacity(baseOpacity: number): number {
  if (baseOpacity < 0) {
    return 0.2
  }

  const secondary = baseOpacity + 0.3
  return Math.min(secondary, 1.0)
}

export function calculateTertiaryOpacity(baseOpacity: number): number {
  const tertiary = calculateSecondaryOpacity(baseOpacity) + 0.3
  return Math.min(tertiary, 1.0)
}

/**
 * Background colour for a card/chrome surface at a given opacity.
 *
 * These resolve through the themeable CSS variables (with the original Windows
 * 11 values as fallbacks) rather than fixed rgb() literals, so cards and chrome
 * re-skin with the active theme. The opacity slider is preserved via color-mix
 * toward transparent; a fully opaque value skips the mix entirely.
 */
function surfaceStyle(colorVar: string, opacity: number) {
  if (opacity >= 1) {
    return { backgroundColor: colorVar }
  }
  const pct = Math.round(Math.max(0, Math.min(1, opacity)) * 100)
  return { backgroundColor: `color-mix(in srgb, ${colorVar} ${pct}%, transparent)` }
}

export function getTertiaryBackgroundStyle(isDark: boolean, opacity: number) {
  return surfaceStyle(
    isDark ? 'var(--w-bg-tertiary, #383838)' : 'var(--wl-bg-tertiary, #e5e5e5)',
    opacity
  )
}

export function getCardBackgroundStyle(isDark: boolean, opacity: number) {
  return surfaceStyle(
    isDark ? 'var(--w-bg-card, #2d2d2d)' : 'var(--wl-bg-card, #ffffff)',
    opacity
  )
}
