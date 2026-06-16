# Privacy

PenguinClip stores clipboard history locally with no telemetry. Beyond that, it
offers explicit controls to keep sensitive content out of history.

## Exclusion rules

**Settings → Privacy → Exclusion rules.** Add regular expressions; any clipboard
text matching a pattern is **never recorded**. Examples:

| Pattern | Excludes |
| --- | --- |
| `\d{16}` | 16-digit card-like numbers |
| `(?i)password` | anything containing "password" (case-insensitive) |
| `-----BEGIN [A-Z ]+PRIVATE KEY-----` | PEM private keys |

Rules apply immediately and persist in your settings. Invalid patterns are
ignored (and noted in the log) rather than blocking the whole rule set.

## Pause recording

The tray menu has a checkable **Pause recording** item. While paused, new
clipboard items are not captured (automatic cleanup of existing items still
runs). The pause is **runtime-only** — it resets to recording when the app
restarts, so history can't silently stop because of a forgotten pause.

## Automatic cleanup

**Settings → Auto-delete** removes history items older than a configurable
interval. Pinned and favorited items are never auto-deleted.

## What is stored, and where

- Text/rich-text history and image thumbnails: `~/.local/share/penguinclip/history.json`
- Full-resolution images: `~/.local/share/penguinclip/blobs/` (read only when pasting)
- Logs: `~/.local/share/penguinclip/logs/` — these never contain clipboard content (see [DIAGNOSTICS.md](DIAGNOSTICS.md)).

Clearing history (and deleting items) also removes the associated image blobs.
