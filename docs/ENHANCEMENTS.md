# PenguinClip Enhancement Summary

An incremental hardening pass across performance, stability, diagnostics,
storage, search, privacy, updates, Linux integration, and code quality. No
rewrite — existing features and workflows were preserved. Delivered as 24
focused commits; the full suite (37 Rust + 6 frontend tests, `clippy -D
warnings`, lint, build) is green throughout.

## 1. Findings

The dominant issue was the **storage model**: full-resolution clipboard images
were base64-encoded inline in `history.json` and kept resident in a
`Vec<ClipboardItem>` for the whole session. That single root cause drove the
top findings:

- **High idle RAM** — every screenshot stayed in memory as inflated base64.
- **Expensive IPC** — the entire history (with all images) was re-serialized and
  re-fetched over the Tauri bridge on every clipboard change.
- **Costly writes** — every mutation rewrote the whole pretty-printed JSON.
- **Unvirtualized UI** — the list rendered every row and decoded every image up
  front; an `index * 30ms` fade-in delay made deep rows wait seconds.
- **Lock contention** — the watch loop held the manager lock across blocking OS
  clipboard reads, stalling paste/UI.
- **Silent data loss** — a corrupt `history.json` was discarded with no backup,
  no recovery, and no user signal; runtime errors were swallowed.
- **No diagnostics** — only `eprintln!`, lost when run via tray/autostart.
- **No update awareness** and **no in-app privacy controls** beyond auto-delete.

## 2. Changes

**Performance** — disk-backed image blobs (`blobs/<hash>.png` + thumbnail),
lock-free clipboard reads, off-screen render skipping (`content-visibility`) +
lazy images, capped fade-in.

**Stability** — atomic history writes (`temp → fsync → rename`); corruption
recovery with per-item salvage + timestamped backup; load problems and runtime
errors surfaced in a dismissible UI banner.

**Diagnostics** — structured rotating logger behind the `log` facade, panic-hook
crash capture, startup environment summary, and a redaction-safe diagnostics
export. DE/session/shortcut/focus paths routed through it.

**Storage** — image re-copy de-duplication and a startup orphan-blob sweep;
refcounted blob cleanup on delete/trim/clear/auto-delete.

**Search** — Fuse.js fuzzy, relevance-ranked history search (regex mode kept).

**Privacy** — regex exclusion rules and a runtime pause-recording tray toggle.

**Updates** — GitHub-releases version check (notify only; updating stays with the
package manager).

**Code quality** — dead-code removal, persistence logging migration, docs.

## 3. Performance improvements

Measured by the reproducible benchmark (`src-tauri/examples/history_memory.rs`,
see [PERFORMANCE.md](PERFORMANCE.md)): for 50 synthetic 1080p images, the
resident / IPC history payload dropped **~96.8%** (238.7 MiB → 7.6 MiB), with
full images moved to disk and read only on paste. Idle memory and per-copy sync
cost are now bounded by thumbnail size, not full-image size.

## 4. Stability improvements

- History writes are atomic — a crash mid-write can no longer truncate the file.
- A corrupt history is backed up and recovered (valid items kept) instead of
  silently dropped, with an actionable on-screen message.
- Crashes are recorded to the log via a panic hook.
- Previously-silent runtime and persistence errors are now visible (UI banner +
  log).

## 5. Potential future enhancements

- **Password-manager hint detection** (`x-kde-passwordManagerHint: secret`) and
  per-application ignore — both need X11/Wayland-specific MIME/window
  introspection and deserve a dedicated, well-tested change.
- **Debounced / incremental history writes** to cut per-mutation O(n)
  serialization for very large histories (trades a little durability).
- **Optional auto-check for updates** on startup (currently manual by design).
- **In-window "recording paused" indicator** (event already emitted).
- Finish routing the remaining low-value runtime traces
  (`theme_manager`, `gif_manager`, etc.) through the logger.

## 6. Known limitations

- `save_history` still rewrites the whole file per mutation; fine at the default
  (50 items), heavier for very large histories.
- The update check notifies only — it never downloads or self-installs (correct
  for package-manager / AppImage distribution).
- Pause-recording is runtime-only (resets on restart) by design.
- Wayland cannot programmatically restore focus to arbitrary windows; paste there
  relies on the compositor keeping focus (unchanged, degrades gracefully).
