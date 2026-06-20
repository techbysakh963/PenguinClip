/** @type {import('tailwindcss').Config} */
//
// Colours, radii and fonts resolve through CSS custom properties so a theme can
// re-skin the whole app by overriding those variables at runtime (see
// applyTheme / themePacks). Every var carries a fallback equal to the original
// Windows 11 value, so with no theme applied the default look is unchanged.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Using class strategy with useDarkMode hook that syncs with system preference
  theme: {
    extend: {
      colors: {
        // Windows 11 Dark Theme Colors
        win11: {
          // Backgrounds
          'bg-primary': 'var(--w-bg-primary, #202020)',
          'bg-secondary': 'var(--w-bg-secondary, #2d2d2d)',
          'bg-tertiary': 'var(--w-bg-tertiary, #383838)',
          'bg-card': 'var(--w-bg-card, #2d2d2d)',
          'bg-card-hover': 'var(--w-bg-card-hover, #3d3d3d)',
          'bg-accent': 'var(--accent, #0078d4)',
          'bg-accent-hover': 'var(--accent-hover, #1a86d9)',

          // Text
          'text-primary': 'var(--w-text-primary, #ffffff)',
          'text-secondary': 'var(--w-text-secondary, #c5c5c5)',
          'text-tertiary': 'var(--w-text-tertiary, #9e9e9e)',
          'text-disabled': 'var(--w-text-disabled, #6e6e6e)',

          // Borders
          'border': 'var(--w-border, #454545)',
          'border-subtle': 'var(--w-border-subtle, #3a3a3a)',

          // Acrylic/Mica effect
          'acrylic-bg': 'rgba(32, 32, 32, 0.85)',
          'acrylic-tint': 'rgba(255, 255, 255, 0.03)',

          // Semantic colors
          'success': '#6ccb5f',
          'warning': '#fcb900',
          'error': '#ff5f5f',
          'info': '#0078d4',
        },
        // Light mode Windows 11 colors
        win11Light: {
          'bg-primary': 'var(--wl-bg-primary, #f3f3f3)',
          'bg-secondary': 'var(--wl-bg-secondary, #ffffff)',
          'bg-tertiary': 'var(--wl-bg-tertiary, #e5e5e5)',
          'bg-card': 'var(--wl-bg-card, #ffffff)',
          'bg-card-hover': 'var(--wl-bg-card-hover, #f5f5f5)',
          'text-primary': 'var(--wl-text-primary, #1a1a1a)',
          'text-secondary': 'var(--wl-text-secondary, #5c5c5c)',
          'border': 'var(--wl-border, #e5e5e5)',
          'acrylic-bg': 'rgba(243, 243, 243, 0.85)',
        }
      },
      borderRadius: {
        'win11': 'var(--w-radius, 8px)',
        'win11-lg': 'var(--w-radius-lg, 12px)',
      },
      boxShadow: {
        'win11': '0 8px 32px rgba(0, 0, 0, 0.25)',
        'win11-card': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'win11-elevated': '0 16px 48px rgba(0, 0, 0, 0.35)',
      },
      fontFamily: {
        'sans': ['var(--font-ui, "Inter Variable")', '"Inter"', '"Segoe UI Variable"', 'system-ui', 'sans-serif'],
        'segoe': ['var(--font-ui, "Inter Variable")', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
