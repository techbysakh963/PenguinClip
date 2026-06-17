# PenguinClip v1.0.0

A stability and performance milestone. PenguinClip now keeps idle memory low even
with image-heavy histories, recovers from corruption instead of losing data, and
adds search, privacy, diagnostics, and update-awareness — without changing how you
use it.

## Highlights

### Performance
- **Disk-backed image store** — images now keep only a small thumbnail in memory;
  full-resolution pixels live on disk and are read only when pasted. For an
  image-heavy history this cuts the resident/IPC payload by **~97%**.
- **Smoother large histories** — off-screen rows skip layout/paint, images load
  lazily, and the clipboard watcher no longer blocks the UI while reading.

### Reliability
- **Crash-safe storage** — history is written atomically; a crash can no longer
  truncate it.
- **Corruption recovery** — a damaged history file is backed up and salvaged
  (valid items kept) instead of silently discarded, with an on-screen notice.
- **Visible errors** — paste/delete/pin failures now surface instead of failing
  silently.

### New features
- **Fuzzy search** — typo-tolerant, relevance-ranked history search (regex mode
  still available).
- **Privacy** — regex **exclusion rules** (never record matching text) and a
  **Pause recording** tray toggle.
- **Image files** — copying an image *file* from your file manager now stores it
  as an image with a thumbnail, instead of a raw file path.
- **Diagnostics export** — one-click, content-free report for bug reports.
- **Update check** — Settings tells you when a newer release is available.

### Quality
- Structured logging with crash capture, comprehensive desktop-environment
  diagnostics, dead-code cleanup, and expanded test coverage.

## Upgrading

Install the new package over your existing one (see
[INSTALL.md](https://github.com/techbysakh963/PenguinClip/blob/master/docs/INSTALL.md)).
Existing histories are migrated automatically — old inline images move to the new
on-disk blob store on first launch.

## Documentation

- [Installation](https://github.com/techbysakh963/PenguinClip/blob/master/docs/INSTALL.md)
- [Privacy](https://github.com/techbysakh963/PenguinClip/blob/master/docs/PRIVACY.md)
- [Diagnostics](https://github.com/techbysakh963/PenguinClip/blob/master/docs/DIAGNOSTICS.md)
- [Performance notes](https://github.com/techbysakh963/PenguinClip/blob/master/docs/PERFORMANCE.md)
