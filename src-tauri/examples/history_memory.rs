//! History memory benchmark.
//!
//! Quantifies the effect of the disk-backed image blob change: how much of an
//! image-heavy history stays resident in memory / crosses the Tauri IPC bridge
//! (the serialized `get_history()` payload), versus the legacy inline-base64
//! representation where every full image lived in that same payload.
//!
//! Run with:
//!     cargo run --example history_memory            # defaults: 50 images @ 1920x1080
//!     cargo run --example history_memory -- 200 2560 1440
//!
//! The image content is synthetic (a deterministic banded pattern), chosen to
//! produce non-trivial PNGs in the same ballpark as real screenshots rather
//! than the few bytes a solid color would compress to.

use std::time::Instant;

use arboard::ImageData;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{DynamicImage, ImageFormat, RgbaImage};
use penguinclip_lib::clipboard_manager::ClipboardManager;

/// Builds a deterministic, moderately-compressible RGBA image.
fn synthetic_image(width: usize, height: usize, seed: usize) -> ImageData<'static> {
    let mut bytes = Vec::with_capacity(width * height * 4);
    for y in 0..height {
        for x in 0..width {
            let r = ((x * 7 + y * 13 + seed * 29) % 256) as u8;
            let g = (((x ^ y).wrapping_add(seed * 17)) % 256) as u8;
            let b = (((x / 8 + y / 8) * 5 + seed) % 256) as u8;
            bytes.extend_from_slice(&[r, g, b, 255]);
        }
    }
    ImageData {
        width,
        height,
        bytes: bytes.into(),
    }
}

/// Encodes raw RGBA to a full-resolution PNG (the legacy inline format).
fn full_png(image: &ImageData) -> Vec<u8> {
    let rgba = RgbaImage::from_raw(
        image.width as u32,
        image.height as u32,
        image.bytes.to_vec(),
    )
    .expect("dimensions match bytes");
    let mut buf = std::io::Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(rgba)
        .write_to(&mut buf, ImageFormat::Png)
        .expect("png encode");
    buf.into_inner()
}

/// Resident set size of this process in bytes (Linux /proc).
fn rss_bytes() -> u64 {
    let statm = std::fs::read_to_string("/proc/self/statm").unwrap_or_default();
    let resident_pages: u64 = statm
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    resident_pages * (page_size())
}

fn page_size() -> u64 {
    // 4 KiB on every platform this app targets.
    4096
}

fn mib(bytes: u64) -> f64 {
    bytes as f64 / (1024.0 * 1024.0)
}

fn dir_size(path: &std::path::Path) -> u64 {
    std::fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let count: usize = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(50);
    let width: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1920);
    let height: usize = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(1080);

    let dir = std::env::temp_dir().join("penguinclip_bench");
    let _ = std::fs::remove_dir_all(&dir);
    let history_path = dir.join("history.json");

    println!("PenguinClip history memory benchmark");
    println!("  images : {count} @ {width}x{height}\n");

    let rss_start = rss_bytes();

    // --- Populate a history through the real public API (writes blobs). ---
    let mut legacy_inline_payload: u64 = 0;
    let mut full_png_total: u64 = 0;
    {
        let mut manager = ClipboardManager::new(history_path.clone(), count + 10);
        for i in 0..count {
            let image = synthetic_image(width, height, i);
            // What the legacy code would have put inline in history.json / IPC:
            let png = full_png(&image);
            full_png_total += png.len() as u64;
            legacy_inline_payload += BASE64.encode(&png).len() as u64;
            // The current path: full PNG -> blob, thumbnail -> inline.
            manager.add_image(image, i as u64);
        }

        // Current resident / IPC payload == serialized get_history().
        let history = manager.get_history();
        let new_inline_payload = serde_json::to_vec(&history).unwrap().len() as u64;

        let history_json_size = std::fs::metadata(&history_path)
            .map(|m| m.len())
            .unwrap_or(0);
        let blobs_size = dir_size(&dir.join("blobs"));

        let reduction = 100.0 * (1.0 - new_inline_payload as f64 / legacy_inline_payload as f64);

        println!("Resident / IPC history payload (the get_history() result):");
        println!(
            "  legacy (full images inline) : {:>8.2} MiB",
            mib(legacy_inline_payload)
        );
        println!(
            "  current (thumbnails inline) : {:>8.2} MiB   ({reduction:.1}% smaller)",
            mib(new_inline_payload)
        );
        println!();
        println!("On disk:");
        println!(
            "  history.json                : {:>8.2} MiB",
            mib(history_json_size)
        );
        println!(
            "  blobs/ (full images, read only on paste) : {:>8.2} MiB",
            mib(blobs_size)
        );
        println!(
            "  (full PNG bytes total       : {:>8.2} MiB)",
            mib(full_png_total)
        );
        println!();
    }

    // --- Cold load: construct a fresh manager from the saved history. ---
    let load_start = Instant::now();
    let reloaded = ClipboardManager::new(history_path, count + 10);
    let load_ms = load_start.elapsed().as_secs_f64() * 1000.0;
    let loaded = reloaded.get_history().len();

    let rss_end = rss_bytes();

    println!("Cold load (construct manager from saved history.json):");
    println!("  items loaded                : {loaded}");
    println!("  load time                   : {load_ms:.1} ms");
    println!();
    println!("Process RSS:");
    println!(
        "  before populate             : {:>8.2} MiB",
        mib(rss_start)
    );
    println!("  after populate + reload     : {:>8.2} MiB", mib(rss_end));

    let _ = std::fs::remove_dir_all(std::env::temp_dir().join("penguinclip_bench"));
}
