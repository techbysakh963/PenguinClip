# Premium Glass UI — Design

Status: approved direction, foundation slice spec
Date: 2026-06-17

## Goal

Give PenguinClip a premium, intentionally-designed feel (Windows 11 / Fluent /
Raycast / Arc quality bar) without a frontend rewrite. The look must survive an
**opaque window** — the primary dev/test machine is NVIDIA, where the compositor
disables window transparency (`useRenderingEnv().transparency_disabled === true`).
True acrylic is layered on **only where it actually renders**.

## Key constraint: adaptive glass

Two rendering realities, one design:

- **Transparent setups** (most Wayland/X11 compositors): the window itself can be
  translucent. The shell uses real acrylic — translucent background + `backdrop-filter`
  blurring the desktop behind it.
- **Opaque setups** (NVIDIA, AppImage, `transparency_disabled`): the window is solid.
  Premium feel comes from *layered surfaces, soft layered shadows, generous radii,
  refined typography, accent system, and motion* — none of which need compositor
  transparency.
- **In-app panels** (search bar, context menus, toasts) use `backdrop-filter` over the
  app's **own** content. This renders **everywhere**, including NVIDIA, because it blurs
  sibling content inside the webview rather than the desktop. So real glass for these
  panels is available on every machine.

Mechanism: `useRenderingEnv` resolves the environment; CSS reads
`:root[data-fx='glass']` vs `:root[data-fx='opaque']` to switch the shell between
translucent-acrylic and premium-opaque, while in-app `.glass-panel` blur is the same
in both.

**Important — window acrylic is gated.** The main window is currently
`"transparent": false` in `tauri.conf.json` (all windows), so true desktop-behind
acrylic is impossible for *every* machine until that flag is flipped, `<body>` is made
transparent, and the result is verified on a transparent compositor (it has glitched on
NVIDIA before — the reason the opaque fallback exists). A `backdrop-filter` on the root
of an opaque window blurs only the solid body = no visible effect, so enabling the glass
shell prematurely would look worse, not better. Therefore the shell is gated behind a
`WINDOW_ACRYLIC_ENABLED` constant (currently `false`): every machine gets the verified
premium-opaque shell now. The full token/CSS/`data-fx` infrastructure is in place, so
turning real window acrylic on later is: set tauri `transparent: true`, make body
transparent under `[data-fx='glass']`, flip the flag, test on a transparent DE.

In-app `.glass-panel` blur (Slice 3+) is **not** gated — it blurs the app's own content
and renders real glass on every machine including this NVIDIA box.

## Design token layer (the foundation — Slice 1)

All visual values move to CSS custom properties in `index.css`, defined for light
(`:root`) and dark (`:root.dark`). Existing `win11*` Tailwind colors are kept and a
few are aliased to tokens so nothing regresses; tokens are **additive**.

**Surfaces (elevation):**
- `--surface-0` window background
- `--surface-1` cards / primary panels
- `--surface-2` raised / hover / search bar
- `--surface-3` popovers / menus / toasts
- `--surface-border`, `--surface-border-strong`

**Glass:**
- `--glass-bg`, `--glass-border`, `--glass-blur` (e.g. `20px`), `--glass-saturate`
- Shell: `[data-fx='glass'] .app-shell` → translucent `--glass-bg` + blur;
  `[data-fx='opaque'] .app-shell` → solid `--surface-0` + `--shadow-lg`.

**Radii:** `--radius-window:18px`, `--radius-card:14px`, `--radius-control:11px`,
`--radius-menu:12px`, `--radius-search:16px`. (Within the doc's 16–24 / 14–18 / 10–14 ranges.)

**Shadows (soft, layered, never harsh black):**
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glass` — multi-stop rgba,
  low alpha, tuned per light/dark.

**Accent (token now, user-customizable later):**
- `--accent`, `--accent-hover`, `--accent-contrast`, `--accent-subtle` (selection bg),
  `--accent-ring`. Defaults to current `#0078d4`.

**Motion:**
- `--motion-fast:120ms`, `--motion-base:180ms`, `--motion-slow:260ms`
- `--ease-out:cubic-bezier(.2,.8,.2,1)`, `--ease-emphasized:cubic-bezier(.2,.9,.1,1)`
- Respect `prefers-reduced-motion`: collapse durations to ~0.

**Utility classes (`@layer components`):** `.app-shell`, `.surface-1/2/3`,
`.glass-panel`, `.elevate` (hover-raise transition), `.focus-ring` (retokenized).

## Slice 1 scope (this spec) — what changes now

1. `index.css`: add the token layer + adaptive glass classes + reduced-motion guard.
2. `ClipboardApp.tsx`: set `data-fx` from `useRenderingEnv`; replace the hardcoded
   `glass-effect-opaque` shell classes with `.app-shell` + window radius/shadow tokens.
3. Keep all existing components rendering correctly (no card/search redesign yet — that
   is Slice 2/3). Verify the shell still looks right opaque on the NVIDIA box.

**Out of scope for Slice 1:** card redesign, search bar, sidebar, settings, toasts,
typography swap. Those are later slices that *consume* this token layer.

## Subsequent slices (agreed sequence, specced when reached)

2. Clipboard item cards — hover elevation, layout, richer type/category treatment.
3. Search experience — floating glass search bar, instant results, focus motion.
4. Motion + toasts + empty states.
5. Sidebar + settings + typography.

## Testing / verification

- `npm run build` (tsc) + `npm run lint` clean after each slice.
- Existing vitest suite stays green.
- Manual: launch installed app on `DISPLAY=:1`, confirm shell renders premium-opaque
  (no broken transparency, correct radius/shadow) on the NVIDIA box.

## Non-goals

- No window-manager/compositor changes.
- No new heavy dependencies (use CSS + existing lucide-react/clsx/tailwind v4).
- No regression to current feature behavior.
