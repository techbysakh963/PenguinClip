# Diagnostics & Logging

PenguinClip writes a structured log and can export a shareable diagnostics
report to help troubleshoot issues — especially desktop-environment-specific
ones (shortcuts, paste focus, theming).

## Logging

- **Location:** `~/.local/share/penguinclip/logs/penguinclip.log`
- **Format:** `2026-06-16T18:40:00.123Z [INFO ] target: message`
- **Rotation:** the log rotates to `penguinclip.log.1` once it passes 2 MiB, so it
  never grows unbounded.
- **Levels:** `error`, `warn`, `info`, `debug`, `trace`. Default is `info`
  (release) / `debug` (debug builds).
- **Override the level** with the `PENGUINCLIP_LOG` environment variable:

  ```bash
  PENGUINCLIP_LOG=debug penguinclip
  ```

The log captures startup environment (version, OS/arch, session type, desktop),
the detected global-shortcut handler and per-shortcut registration results,
window-focus/activation steps, history corruption recovery, and **crashes**
(a panic hook records the location and message before the process exits).

## Exporting diagnostics

Open **Settings → Diagnostics → Export diagnostics**. This writes a
`penguinclip-diagnostics-<timestamp>.txt` file (path is shown after export)
containing:

- App version and environment (OS/arch, Wayland/X11, desktop)
- The recent log tail

Attach this file when reporting an issue.

## Privacy

The log and the exported report **never contain clipboard content**. Only
operational metadata is recorded — item ids, sizes, error messages, and host
environment. They are safe to share. (Clipboard exclusion rules and the
recording pause are documented in [PRIVACY.md](PRIVACY.md).)
