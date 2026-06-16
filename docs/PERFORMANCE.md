# Performance notes

## Disk-backed image blobs (idle memory & IPC)

Clipboard images used to be base64-encoded **inline** in `history.json` and kept
in the in-memory `Vec<ClipboardItem>` for the whole session. Every
`get_history()` call (run on startup and after every clipboard change) cloned
and serialized that whole vector across the Tauri IPC bridge — so both idle RAM
and per-copy work grew with the number and size of images.

Images now store their full-resolution PNG in a content-addressed blob store
(`blobs/<hash>.png`) and keep only a ≤256px thumbnail inline. Full pixels are
read back from disk only when an image is actually pasted.

### Benchmark

A reproducible benchmark lives at `src-tauri/examples/history_memory.rs`:

```bash
cd src-tauri
cargo run --example history_memory            # 50 images @ 1920x1080 (default)
cargo run --example history_memory -- 200 2560 1440
```

It builds a synthetic image-heavy history through the real public API and reports
the serialized `get_history()` payload (what stays resident and crosses IPC) for
both the legacy inline representation and the current thumbnail-only one.

### Result (50 synthetic images @ 1920×1080, debug build)

| Metric | Legacy (inline) | Current (blobs) |
| --- | ---: | ---: |
| Resident / IPC history payload | 238.7 MiB | **7.6 MiB** (−96.8%) |
| `history.json` on disk | 238.7 MiB | 7.6 MiB |
| `blobs/` on disk (read only on paste) | — | 179.0 MiB |

The image content is synthetic banded noise, which compresses worse than typical
screenshots — so real-world thumbnails (and therefore the resident payload) are
usually smaller still. The headline is the shape of the win: **the memory and IPC
cost of an image-heavy history is now bounded by thumbnail size, not full-image
size**, and full images live on disk until needed.
