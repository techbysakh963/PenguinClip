//! Clipboard Manager Module
//! Handles clipboard monitoring, history storage, and paste injection

use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use image::{DynamicImage, ImageFormat};
use log::{debug, error, warn};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

// --- Constants ---

pub const DEFAULT_MAX_HISTORY_SIZE: usize = 50;
const PREVIEW_TEXT_MAX_LEN: usize = 100;
const GIF_CACHE_MARKER: &str = "penguinclip/gifs/";
const FILE_URI_PREFIX: &str = "file://";

/// Largest edge (px) of the thumbnail kept inline in history.json for display.
/// Full-resolution pixels live in the blob store; only this small preview is
/// ever resident in memory or serialized with the history.
const THUMBNAIL_MAX_DIM: u32 = 256;

/// Directory name (under the history file's parent) holding full-resolution
/// image blobs, content-addressed by hash.
const BLOB_DIR_NAME: &str = "blobs";

/// File extensions treated as images when an image file is copied from a file
/// manager (the clipboard then holds a file:// URI rather than image bytes).
const IMAGE_FILE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff", "tif", "ico", "avif",
];

/// Extracts a local image-file path from clipboard text. Handles `file://`
/// URIs (with percent-encoding) and plain absolute paths, and only returns
/// `Some` when the path has a known image extension. Does not check existence.
fn parse_image_file_path(text: &str) -> Option<PathBuf> {
    // A uri-list may contain several lines; consider the first non-empty one.
    let first = text.lines().map(str::trim).find(|l| !l.is_empty())?;

    let path = if let Some(rest) = first.strip_prefix("file://") {
        // Skip an optional host component: file://host/path -> /path
        let path_start = rest.find('/')?;
        let decoded = percent_encoding::percent_decode_str(&rest[path_start..])
            .decode_utf8()
            .ok()?;
        PathBuf::from(decoded.as_ref())
    } else if first.starts_with('/') {
        PathBuf::from(first)
    } else {
        return None;
    };

    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    IMAGE_FILE_EXTENSIONS
        .contains(&ext.as_str())
        .then_some(path)
}

// --- Helper Functions ---

// Simple FNV-1a implementation for stable hashing across restarts
// This avoids the randomization of DefaultHasher which causes duplicates on restart
const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;

struct FnvHasher(u64);

impl Default for FnvHasher {
    fn default() -> Self {
        FnvHasher(FNV_OFFSET_BASIS)
    }
}

impl Hasher for FnvHasher {
    fn finish(&self) -> u64 {
        self.0
    }
    fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.0 ^= byte as u64;
            self.0 = self.0.wrapping_mul(FNV_PRIME);
        }
    }
}

/// Calculates a stable hash for any hashable data.
pub fn calculate_hash<T: Hash>(t: &T) -> u64 {
    let mut s = FnvHasher::default();
    t.hash(&mut s);
    s.finish()
}

/// Helper to get a fresh clipboard instance.
fn get_system_clipboard() -> Result<Clipboard, String> {
    Clipboard::new().map_err(|e| e.to_string())
}

// --- Lock-free system clipboard reads ---
//
// These open a fresh `Clipboard` and touch no `ClipboardManager` state, so the
// monitoring loop can poll the OS clipboard *without* holding the manager lock.
// That keeps UI commands (get_history, paste, pin) responsive even while a
// clipboard read is blocking on the compositor.

/// Reads the current clipboard text from the OS.
pub fn read_system_text() -> Result<String, arboard::Error> {
    Clipboard::new()?.get_text()
}

/// Reads the current clipboard HTML, if any.
pub fn read_system_html() -> Option<String> {
    get_system_clipboard().ok()?.get().html().ok()
}

/// Reads the current clipboard image and its stable content hash, if any.
pub fn read_system_image() -> Result<Option<(ImageData<'static>, u64)>, arboard::Error> {
    let mut clipboard = Clipboard::new()?;
    match clipboard.get_image() {
        Ok(image) => {
            let hash = calculate_hash(&image.bytes);
            let owned = ImageData {
                width: image.width,
                height: image.height,
                bytes: image.bytes.into_owned().into(),
            };
            Ok(Some((owned, hash)))
        }
        Err(arboard::Error::ContentNotAvailable) => Ok(None),
        Err(e) => Err(e),
    }
}

// --- Data Structures ---

/// Content type for clipboard items
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum ClipboardContent {
    /// Plain text content
    Text(String),
    /// Rich text with HTML formatting (plain text + optional HTML)
    RichText { plain: String, html: String },
    /// Image content. `base64` is a downscaled PNG thumbnail used for display;
    /// the full-resolution PNG is stored on disk and referenced by `blob`.
    Image {
        /// Base64 PNG shown in the UI. Post-migration this is a thumbnail
        /// (<= THUMBNAIL_MAX_DIM); legacy items hold the full image here until
        /// migrated on load.
        base64: String,
        /// Filename of the full-resolution PNG in the blob store
        /// (e.g. "a1b2c3d4e5f6a7b8.png"). `None` for legacy, un-migrated items.
        #[serde(default)]
        blob: Option<String>,
        width: u32,
        height: u32,
    },
}

/// A single clipboard history item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    /// Unique identifier
    pub id: String,
    /// The content
    pub content: ClipboardContent,
    /// When it was copied
    pub timestamp: DateTime<Utc>,
    /// Whether this item is pinned
    pub pinned: bool,
    /// Whether this item is favorited (starred)
    #[serde(default)]
    pub favorited: bool,
    /// Preview text (for display)
    pub preview: String,
}

impl ClipboardItem {
    pub fn new_text(text: String) -> Self {
        let preview = if text.chars().count() > PREVIEW_TEXT_MAX_LEN {
            format!(
                "{}...",
                &text.chars().take(PREVIEW_TEXT_MAX_LEN).collect::<String>()
            )
        } else {
            text.clone()
        };

        Self::create(ClipboardContent::Text(text), preview)
    }

    pub fn new_rich_text(plain: String, html: String) -> Self {
        let preview = if plain.chars().count() > PREVIEW_TEXT_MAX_LEN {
            format!(
                "{}...",
                &plain.chars().take(PREVIEW_TEXT_MAX_LEN).collect::<String>()
            )
        } else {
            plain.clone()
        };

        Self::create(ClipboardContent::RichText { plain, html }, preview)
    }

    pub fn new_image(
        base64: String,
        blob: Option<String>,
        width: u32,
        height: u32,
        hash: u64,
    ) -> Self {
        // We store the hash in the preview string to persist it across sessions
        // without breaking the serialization schema of existing data.
        let preview = format!("Image ({}x{}) #{}", width, height, hash);

        Self::create(
            ClipboardContent::Image {
                base64,
                blob,
                width,
                height,
            },
            preview,
        )
    }

    /// Returns the blob filename backing this item, if it is a blob-backed image.
    pub fn image_blob(&self) -> Option<&str> {
        match &self.content {
            ClipboardContent::Image {
                blob: Some(name), ..
            } => Some(name.as_str()),
            _ => None,
        }
    }

    fn create(content: ClipboardContent, preview: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content,
            timestamp: Utc::now(),
            pinned: false,
            favorited: false,
            preview,
        }
    }

    /// Attempts to extract the image hash from the preview string.
    /// Returns None if content is not an image or hash is missing.
    pub fn extract_image_hash(&self) -> Option<u64> {
        if !matches!(self.content, ClipboardContent::Image { .. }) {
            return None;
        }
        self.preview
            .split('#')
            .nth(1)
            .and_then(|h| h.parse::<u64>().ok())
    }
}

// --- Manager Logic ---

/// Manages clipboard operations and history
pub struct ClipboardManager {
    history: Vec<ClipboardItem>,
    /// Track the last pasted content to avoid re-adding it to history
    last_pasted_text: Option<String>,
    last_pasted_image_hash: Option<u64>,
    /// Track last added text hash to prevent duplicates from rapid copies
    last_added_text_hash: Option<u64>,
    /// Path to save the history file
    persistence_path: PathBuf,
    /// Maximum number of history items to keep
    max_history_size: usize,
    /// Actionable message describing a problem loading history (e.g. corruption
    /// recovery). `None` after a clean load. Surfaced to the user on startup.
    load_status: Option<String>,
    /// Compiled regex patterns; clipboard text matching any of these is never
    /// stored (user-configurable sensitive-content exclusions).
    excluded_patterns: Vec<Regex>,
}

impl ClipboardManager {
    fn clamp_max_history_size(size: usize) -> usize {
        match size {
            0 => DEFAULT_MAX_HISTORY_SIZE,
            1..=100_000 => size,
            _ => 100_000,
        }
    }

    pub fn new(persistence_path: PathBuf, max_history_size: usize) -> Self {
        // Normalize the requested max size and avoid huge allocations
        let max_size = Self::clamp_max_history_size(max_history_size);
        let mut manager = Self {
            history: Vec::with_capacity(max_size),
            last_pasted_text: None,
            last_pasted_image_hash: None,
            last_added_text_hash: None,
            persistence_path,
            max_history_size: max_size,
            load_status: None,
            excluded_patterns: Vec::new(),
        };
        manager.load_history();
        manager
    }

    /// Sets the sensitive-content exclusion patterns. Invalid regexes are
    /// logged and skipped rather than failing the whole update.
    pub fn set_excluded_patterns(&mut self, patterns: &[String]) {
        self.excluded_patterns = patterns
            .iter()
            .filter(|p| !p.trim().is_empty())
            .filter_map(|p| match Regex::new(p) {
                Ok(re) => Some(re),
                Err(e) => {
                    warn!("ignoring invalid exclusion pattern '{}': {}", p, e);
                    None
                }
            })
            .collect();
    }

    /// Returns an actionable message if the last load had a problem (e.g. the
    /// history file was corrupted and recovered), otherwise `None`.
    pub fn load_status(&self) -> Option<&str> {
        self.load_status.as_deref()
    }

    /// Updates the maximum history size and enforces the new limit
    pub fn set_max_history_size(&mut self, new_size: usize) {
        let mut clamped = Self::clamp_max_history_size(new_size);
        // Do not set max less than number of protected items; we won't delete pins/favorites automatically
        let protected_count = self
            .history
            .iter()
            .filter(|i| i.pinned || i.favorited)
            .count();
        if clamped < protected_count {
            warn!(
                "requested max history size ({}) is less than the number of protected items ({}); increasing limit to preserve them.",
                clamped, protected_count
            );
            clamped = protected_count;
        }
        self.max_history_size = clamped;
        let trimmed = self.enforce_history_limit();
        if trimmed {
            self.save_history();
        }
    }

    /// Gets the current maximum history size
    pub fn get_max_history_size(&self) -> usize {
        self.max_history_size
    }

    fn load_history(&mut self) {
        if !self.persistence_path.exists() {
            return;
        }

        let content = match fs::read_to_string(&self.persistence_path) {
            Ok(content) => content,
            Err(e) => {
                self.set_load_status(format!(
                    "Could not read the clipboard history file ({}). Starting with an empty history.",
                    e
                ));
                return;
            }
        };

        let items = match serde_json::from_str::<Vec<ClipboardItem>>(&content) {
            Ok(items) => items,
            Err(parse_err) => match self.recover_items(&content, &parse_err) {
                // Recovered some items from a partially-corrupt file.
                Some(items) => items,
                // Unrecoverable: recover_items has set the status and backed up.
                None => return,
            },
        };

        self.install_loaded_items(items);
    }

    /// Installs a freshly loaded item set: orders pinned first, migrates legacy
    /// images, enforces the size limit, and seeds duplicate-detection state.
    fn install_loaded_items(&mut self, items: Vec<ClipboardItem>) {
        // Pinned items first, preserving relative order within each group.
        let (mut pinned, unpinned): (Vec<_>, Vec<_>) =
            items.into_iter().partition(|item| item.pinned);
        pinned.extend(unpinned);
        self.history = pinned;

        // Migrate any legacy inline-base64 images into the blob store so
        // memory/IPC stay small for old histories.
        let images_migrated = self.migrate_legacy_images();
        // Ensure loaded history respects the configured limit immediately.
        let history_trimmed = self.enforce_history_limit();
        // Persist if anything changed so disk stays in sync.
        if history_trimmed || images_migrated {
            self.save_history();
        }

        // Seed last_added_text_hash from the most recent item so we don't
        // duplicate it if the clipboard already holds the same content.
        if let Some(first) = self.history.first() {
            self.last_added_text_hash = match &first.content {
                ClipboardContent::Text(text) => Some(calculate_hash(text)),
                ClipboardContent::RichText { plain, .. } => Some(calculate_hash(plain)),
                ClipboardContent::Image { .. } => None,
            };
        }

        // Sweep blob files that survived but are no longer referenced.
        let pruned = self.prune_orphan_blobs();
        if pruned > 0 {
            debug!("pruned {} orphan image blob(s) on load", pruned);
        }
    }

    /// Attempts to salvage items from a file that failed to parse as a whole.
    ///
    /// If the file is still a JSON array, individually-valid items are kept and
    /// the unreadable ones skipped. Otherwise the file is treated as corrupt.
    /// In both cases the original file is backed up and an actionable status is
    /// recorded. Returns `Some(items)` when at least one item was recovered.
    fn recover_items(
        &mut self,
        content: &str,
        parse_err: &serde_json::Error,
    ) -> Option<Vec<ClipboardItem>> {
        if let Ok(values) = serde_json::from_str::<Vec<serde_json::Value>>(content) {
            let total = values.len();
            let recovered: Vec<ClipboardItem> = values
                .into_iter()
                .filter_map(|value| serde_json::from_value::<ClipboardItem>(value).ok())
                .collect();
            let kept = recovered.len();

            if kept > 0 && kept < total {
                let dropped = total - kept;
                let backup_note = self.backup_corrupt_file();
                self.set_load_status(format!(
                    "Recovered {} of {} clipboard items; {} unreadable {} skipped.{}",
                    kept,
                    total,
                    dropped,
                    if dropped == 1 {
                        "entry was"
                    } else {
                        "entries were"
                    },
                    backup_note,
                ));
                return Some(recovered);
            }
            // kept == total can't happen (the strict parse already failed); a
            // zero-recovery array falls through to the corruption path below.
        }

        let backup_note = self.backup_corrupt_file();
        self.set_load_status(format!(
            "The clipboard history file was corrupted and could not be read ({}). Starting with an empty history.{}",
            parse_err, backup_note
        ));
        None
    }

    /// Moves the current (corrupt) history file aside to a timestamped backup so
    /// the user's data is never silently destroyed. Returns a sentence to append
    /// to the status message, or an empty string if no backup could be made.
    fn backup_corrupt_file(&self) -> String {
        let Some(parent) = self.persistence_path.parent() else {
            return String::new();
        };
        let backup = parent.join(format!(
            "history.corrupt-{}.json",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        match fs::rename(&self.persistence_path, &backup) {
            Ok(_) => format!(
                " A backup of the original file was saved to {}.",
                backup.display()
            ),
            Err(e) => {
                error!("failed to back up corrupt history file: {}", e);
                String::new()
            }
        }
    }

    fn set_load_status(&mut self, message: String) {
        warn!("{}", message);
        self.load_status = Some(message);
    }

    pub fn save_history(&self) {
        if let Err(e) = self.write_history_atomically() {
            error!("failed to save history: {}", e);
        }
    }

    /// Persists history using a write-temp-then-rename strategy.
    ///
    /// `rename(2)` within the same directory is atomic on POSIX filesystems,
    /// so a crash or power loss mid-write can never leave a truncated or
    /// half-serialized `history.json` behind. The previous file stays intact
    /// until the new, fully-flushed copy is swapped in.
    fn write_history_atomically(&self) -> std::io::Result<()> {
        use std::io::Write;

        let content = serde_json::to_vec_pretty(&self.history)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        if let Some(parent) = self.persistence_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Unique per-process temp name avoids any chance of two writers
        // clobbering the same scratch file (single-instance makes this rare,
        // but it keeps the invariant cheap and obvious).
        let tmp_path = self
            .persistence_path
            .with_extension(format!("json.{}.tmp", std::process::id()));

        let mut file = fs::File::create(&tmp_path)?;
        file.write_all(&content)?;
        file.sync_all()?;
        drop(file);

        fs::rename(&tmp_path, &self.persistence_path)
    }

    // --- Adding Items ---

    /// Add text content to history, with optional HTML for rich text
    pub fn add_text(&mut self, text: String, html: Option<String>) -> Option<ClipboardItem> {
        if self.should_skip_text(&text) {
            return None;
        }

        let text_hash = calculate_hash(&text);

        // Rapid copy detection
        if Some(text_hash) == self.last_added_text_hash {
            return None;
        }

        // Check if this exact text is already the most recent non-pinned item
        // If so, skip entirely - no need to add or move
        if self.is_duplicate_text(&text) {
            self.last_added_text_hash = Some(text_hash);
            return None;
        }

        // Check if this text exists elsewhere in history (not at top)
        // If so, remove the old entry so we can add fresh at top
        self.remove_duplicate_text_from_history(&text);

        // Create new item - use RichText if HTML is available, otherwise plain Text
        let item = match html {
            Some(html_content) if !html_content.trim().is_empty() => {
                ClipboardItem::new_rich_text(text, html_content)
            }
            _ => ClipboardItem::new_text(text),
        };
        self.insert_item(item.clone());

        self.last_added_text_hash = Some(text_hash);

        Some(item)
    }

    pub fn add_image(&mut self, image_data: ImageData<'_>, hash: u64) -> Option<ClipboardItem> {
        if self.should_skip_image(hash) {
            return None;
        }

        // If this exact image already exists deeper in history, drop the old
        // entry so we re-add it at the top instead of keeping a duplicate. The
        // blob is content-addressed, so the shared file stays referenced.
        self.remove_duplicate_image_from_history(hash);

        let width = image_data.width as u32;
        let height = image_data.height as u32;

        // Persist the full-resolution PNG to the content-addressed blob store.
        let full_png = self.encode_png(&image_data)?;
        let blob_name = format!("{:016x}.png", hash);
        if let Err(e) = self.write_blob(&blob_name, &full_png) {
            error!("failed to write image blob: {}", e);
            return None;
        }

        // Keep only a small thumbnail inline; fall back to the full image if
        // thumbnailing somehow fails so the UI still shows something.
        let thumbnail =
            Self::thumbnail_from_png(&full_png).unwrap_or_else(|| BASE64.encode(&full_png));

        let item = ClipboardItem::new_image(thumbnail, Some(blob_name), width, height, hash);
        self.insert_item(item.clone());
        Some(item)
    }

    /// Adds clipboard text, transparently upgrading an image-file reference
    /// (e.g. a `file://` URI copied from a file manager) into a real image
    /// entry with a thumbnail. Falls back to storing the text when it is not a
    /// readable image file.
    pub fn add_clipboard_text(
        &mut self,
        text: String,
        html: Option<String>,
    ) -> Option<ClipboardItem> {
        // Internal GIF cache URIs are .gif files but must not be treated as
        // pasted images; let the text path skip them as before.
        if !text.contains(GIF_CACHE_MARKER) {
            if let Some(path) = parse_image_file_path(&text) {
                if let Some(item) = self.add_image_from_file(&path) {
                    return Some(item);
                }
                // Looked like an image file but could not be read/decoded;
                // fall through and keep the original text.
            }
        }
        self.add_text(text, html)
    }

    /// Loads an image file from disk and stores it as a blob-backed image item.
    fn add_image_from_file(&mut self, path: &std::path::Path) -> Option<ClipboardItem> {
        let bytes = fs::read(path).ok()?;
        let rgba = image::load_from_memory(&bytes).ok()?.to_rgba8();
        let (width, height) = (rgba.width() as usize, rgba.height() as usize);
        let image_data = ImageData {
            width,
            height,
            bytes: rgba.into_raw().into(),
        };
        let hash = calculate_hash(&image_data.bytes);
        self.add_image(image_data, hash)
    }

    // --- Blob store helpers ---

    /// Absolute path to the image blob directory (sibling of history.json).
    fn blobs_dir(&self) -> PathBuf {
        self.persistence_path
            .parent()
            .map(|p| p.join(BLOB_DIR_NAME))
            .unwrap_or_else(|| PathBuf::from(BLOB_DIR_NAME))
    }

    /// Atomically writes a blob. Content-addressed names mean an existing file
    /// already holds identical bytes, so we skip the rewrite.
    fn write_blob(&self, name: &str, bytes: &[u8]) -> std::io::Result<()> {
        Self::write_blob_to(&self.blobs_dir(), name, bytes)
    }

    fn write_blob_to(dir: &std::path::Path, name: &str, bytes: &[u8]) -> std::io::Result<()> {
        use std::io::Write;

        fs::create_dir_all(dir)?;
        let target = dir.join(name);
        if target.exists() {
            return Ok(());
        }
        let tmp = dir.join(format!("{}.{}.tmp", name, std::process::id()));
        let mut file = fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp, &target)
    }

    /// Encodes raw RGBA clipboard image data to a PNG byte buffer.
    fn encode_png(&self, image_data: &ImageData<'_>) -> Option<Vec<u8>> {
        let img = DynamicImage::ImageRgba8(image::RgbaImage::from_raw(
            image_data.width as u32,
            image_data.height as u32,
            image_data.bytes.to_vec(),
        )?);
        let mut buffer = Cursor::new(Vec::new());
        img.write_to(&mut buffer, ImageFormat::Png).ok()?;
        Some(buffer.into_inner())
    }

    /// Produces a downscaled base64 PNG thumbnail from full PNG bytes,
    /// preserving aspect ratio. Returns the original (re-encoded) if it is
    /// already within the thumbnail bound.
    fn thumbnail_from_png(png_bytes: &[u8]) -> Option<String> {
        let img = image::load_from_memory(png_bytes).ok()?;
        let scaled = if img.width() > THUMBNAIL_MAX_DIM || img.height() > THUMBNAIL_MAX_DIM {
            img.thumbnail(THUMBNAIL_MAX_DIM, THUMBNAIL_MAX_DIM)
        } else {
            img
        };
        let mut buffer = Cursor::new(Vec::new());
        scaled.write_to(&mut buffer, ImageFormat::Png).ok()?;
        Some(BASE64.encode(buffer.get_ref()))
    }

    /// Reconstructs the full-resolution RGBA pixels for an image item, reading
    /// from the blob store when available and falling back to inline base64 for
    /// any legacy item. Returns (width, height, rgba_bytes).
    pub fn full_image_data(&self, item: &ClipboardItem) -> Result<(u32, u32, Vec<u8>), String> {
        let ClipboardContent::Image { base64, blob, .. } = &item.content else {
            return Err("clipboard item is not an image".to_string());
        };

        let png_bytes = match blob {
            Some(name) => {
                let path = self.blobs_dir().join(name);
                fs::read(&path)
                    .map_err(|e| format!("Failed to read image blob '{}': {}", name, e))?
            }
            None => BASE64
                .decode(base64)
                .map_err(|e| format!("Base64 decode failed: {}", e))?,
        };

        let img =
            image::load_from_memory(&png_bytes).map_err(|e| format!("Image load failed: {}", e))?;
        let rgba = img.to_rgba8();
        Ok((rgba.width(), rgba.height(), rgba.into_raw()))
    }

    /// Removes a blob file only when no remaining history item references it
    /// (several items may share one content-addressed blob).
    fn cleanup_blob(&self, blob_name: &str) {
        let still_referenced = self
            .history
            .iter()
            .any(|item| item.image_blob() == Some(blob_name));
        if !still_referenced {
            let _ = fs::remove_file(self.blobs_dir().join(blob_name));
        }
    }

    /// Removes blob files that no history item references — leftovers from a
    /// crash between writing a blob and saving history, or from older versions.
    /// Bounds blob-store growth. Returns the number of files removed.
    fn prune_orphan_blobs(&self) -> usize {
        use std::collections::HashSet;

        let referenced: HashSet<&str> =
            self.history.iter().filter_map(|i| i.image_blob()).collect();

        let mut removed = 0;
        if let Ok(entries) = fs::read_dir(self.blobs_dir()) {
            for entry in entries.flatten() {
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();
                // Only touch finished blobs; never in-flight ".tmp" scratch files.
                if name.ends_with(".png")
                    && !referenced.contains(name.as_ref())
                    && fs::remove_file(entry.path()).is_ok()
                {
                    removed += 1;
                }
            }
        }
        removed
    }

    /// Extracts any legacy inline-base64 images into the blob store, replacing
    /// the inline data with a thumbnail. Returns true if anything changed.
    fn migrate_legacy_images(&mut self) -> bool {
        let blobs_dir = self.blobs_dir();
        let mut migrated = false;
        for item in self.history.iter_mut() {
            if Self::migrate_item_image(item, &blobs_dir) {
                migrated = true;
            }
        }
        migrated
    }

    fn migrate_item_image(item: &mut ClipboardItem, blobs_dir: &std::path::Path) -> bool {
        // The original hash is recorded in the preview ("Image (WxH) #hash");
        // fall back to a content hash of the bytes if it is missing.
        let preview_hash = item.extract_image_hash();

        let ClipboardContent::Image { base64, blob, .. } = &mut item.content else {
            return false;
        };
        if blob.is_some() {
            return false; // already blob-backed
        }
        let Ok(full_bytes) = BASE64.decode(base64.as_bytes()) else {
            return false; // leave unparseable data untouched
        };

        let name_hash = preview_hash.unwrap_or_else(|| calculate_hash(&full_bytes));
        let blob_name = format!("{:016x}.png", name_hash);
        if Self::write_blob_to(blobs_dir, &blob_name, &full_bytes).is_err() {
            return false; // keep inline data if the blob write failed
        }

        if let Some(thumb) = Self::thumbnail_from_png(&full_bytes) {
            *base64 = thumb;
        }
        *blob = Some(blob_name);
        true
    }

    // --- State Management Helpers ---

    fn should_skip_text(&mut self, text: &str) -> bool {
        if text.trim().is_empty() {
            return true;
        }

        // User-defined sensitive-content exclusions. We never log the content
        // itself, only that something was excluded.
        if self.excluded_patterns.iter().any(|re| re.is_match(text)) {
            debug!("skipping clipboard text matching an exclusion pattern");
            return true;
        }

        // Skip internal GIF cache URIs
        if text.contains(FILE_URI_PREFIX) && text.contains(GIF_CACHE_MARKER) {
            debug!("skipping GIF cache URI");
            return true;
        }

        // Skip self-pasted content
        if let Some(ref pasted) = self.last_pasted_text {
            if pasted == text || text.contains(pasted) {
                // Clear the lock so future copies allow this text
                self.last_pasted_text = None;
                return true;
            }
        }

        false
    }

    fn should_skip_image(&mut self, hash: u64) -> bool {
        // Check if just pasted
        if let Some(pasted_hash) = self.last_pasted_image_hash {
            if pasted_hash == hash {
                self.last_pasted_image_hash = None;
                return true;
            }
        }

        // Check if it's the exact same image as the most recent non-pinned item
        if let Some(item) = self.history.iter().find(|item| !item.pinned) {
            if let Some(item_hash) = item.extract_image_hash() {
                if item_hash == hash {
                    return true;
                }
            }
        }

        false
    }

    fn is_duplicate_text(&self, text: &str) -> bool {
        // Check only the very first non-pinned item for exact match logic
        // used in rapid detection
        if let Some(item) = self.history.iter().find(|item| !item.pinned) {
            match &item.content {
                ClipboardContent::Text(t) if t == text => return true,
                ClipboardContent::RichText { plain, .. } if plain == text => return true,
                _ => {}
            }
        }
        false
    }

    fn remove_duplicate_text_from_history(&mut self, text: &str) {
        if let Some(pos) = self.history.iter().position(|item| {
            if item.pinned {
                return false;
            }
            match &item.content {
                ClipboardContent::Text(t) => t == text,
                ClipboardContent::RichText { plain, .. } => plain == text,
                _ => false,
            }
        }) {
            self.history.remove(pos);
        }
    }

    fn remove_duplicate_image_from_history(&mut self, hash: u64) {
        if let Some(pos) = self
            .history
            .iter()
            .position(|item| !item.pinned && item.extract_image_hash() == Some(hash))
        {
            self.history.remove(pos);
        }
    }

    fn insert_item(&mut self, item: ClipboardItem) {
        // Insert after pinned items (first non-pinned slot)
        // If all items are pinned, insert at the end to preserve pinned ordering
        let insert_pos = self
            .history
            .iter()
            .position(|i| !i.pinned)
            .unwrap_or(self.history.len());
        self.history.insert(insert_pos, item);

        // Trim history
        self.enforce_history_limit();
        self.save_history();
    }

    /// Enforce the configured history size. Returns true if trimming occurred.
    fn enforce_history_limit(&mut self) -> bool {
        let before = self.history.len();
        let mut removed_blobs = Vec::new();
        while self.history.len() > self.max_history_size {
            // Remove from the end, skipping pinned and favorited items
            if let Some(pos) = self.history.iter().rposition(|i| !i.pinned && !i.favorited) {
                let removed = self.history.remove(pos);
                if let Some(blob) = removed.image_blob() {
                    removed_blobs.push(blob.to_string());
                }
            } else {
                // All items are pinned or favorited. Stop removing.
                break;
            }
        }
        for blob in &removed_blobs {
            self.cleanup_blob(blob);
        }
        self.history.len() != before
    }

    // --- Accessors ---

    pub fn get_history(&self) -> Vec<ClipboardItem> {
        self.history.clone()
    }

    pub fn get_item(&self, id: &str) -> Option<&ClipboardItem> {
        self.history.iter().find(|item| item.id == id)
    }

    pub fn clear(&mut self) {
        let removed_blobs: Vec<String> = self
            .history
            .iter()
            .filter(|item| !(item.pinned || item.favorited))
            .filter_map(|item| item.image_blob().map(String::from))
            .collect();

        self.history.retain(|item| item.pinned || item.favorited);

        for blob in &removed_blobs {
            self.cleanup_blob(blob);
        }
        self.save_history();
    }

    pub fn remove_item(&mut self, id: &str) {
        let removed_blob = self
            .history
            .iter()
            .find(|item| item.id == id)
            .and_then(|item| item.image_blob().map(String::from));

        self.history.retain(|item| item.id != id);

        if let Some(blob) = removed_blob {
            self.cleanup_blob(&blob);
        }
        self.save_history();
    }

    pub fn toggle_pin(&mut self, id: &str) -> Option<ClipboardItem> {
        // Find the item and toggle its pin status
        let pos = self.history.iter().position(|i| i.id == id)?;
        self.history[pos].pinned = !self.history[pos].pinned;

        // Reposition the item so the invariant
        let item = self.history.remove(pos);
        let insert_pos = self
            .history
            .iter()
            .position(|i| !i.pinned)
            .unwrap_or(self.history.len());
        self.history.insert(insert_pos, item);

        let item_clone = self.history[insert_pos].clone();
        self.save_history();
        Some(item_clone)
    }

    pub fn toggle_favorite(&mut self, id: &str) -> Option<ClipboardItem> {
        let item = self.history.iter_mut().find(|i| i.id == id)?;
        item.favorited = !item.favorited;
        let item_clone = item.clone();
        self.save_history();
        Some(item_clone)
    }

    /// Move an item to the top of the history (respecting pinned items)
    /// If the item is pinned, it moves to the top of pinned items
    /// If not pinned, it moves to the first non-pinned position
    pub fn move_item_to_top(&mut self, id: &str) -> bool {
        let current_pos = match self.history.iter().position(|i| i.id == id) {
            Some(pos) => pos,
            None => return false,
        };
        let item_pinned = self.history[current_pos].pinned;
        let insert_pos = if item_pinned {
            0
        } else {
            self.history
                .iter()
                .position(|i| !i.pinned)
                .unwrap_or(self.history.len())
        };
        if insert_pos == current_pos {
            return true;
        }
        let item = self.history.remove(current_pos);
        self.history.insert(insert_pos, item);
        self.save_history();
        true
    }

    pub fn cleanup_old_items(&mut self, interval_minutes: u64) -> bool {
        if interval_minutes == 0 {
            return false;
        }

        let now = Utc::now();
        let interval_seconds = (interval_minutes * 60) as i64;
        let mut changed = false;
        let mut removed_blobs = Vec::new();

        // Use a more robust time comparison
        self.history.retain(|item| {
            if item.pinned || item.favorited {
                return true;
            }

            let age_seconds = now.signed_duration_since(item.timestamp).num_seconds();
            let keep = age_seconds < interval_seconds;

            if !keep {
                changed = true;
                if let Some(blob) = item.image_blob() {
                    removed_blobs.push(blob.to_string());
                }
                debug!(
                    "auto-deleting old item: {} (age: {}s, limit: {}s)",
                    item.id, age_seconds, interval_seconds
                );
            }
            keep
        });

        if changed {
            for blob in &removed_blobs {
                self.cleanup_blob(blob);
            }
            self.save_history();
        }

        changed
    }

    // --- Paste Logic ---

    pub fn mark_as_pasted(&mut self, item: &ClipboardItem) {
        match &item.content {
            ClipboardContent::Text(text) => {
                self.last_pasted_text = Some(text.clone());
                self.last_pasted_image_hash = None;
            }
            ClipboardContent::RichText { plain, .. } => {
                self.last_pasted_text = Some(plain.clone());
                self.last_pasted_image_hash = None;
            }
            ClipboardContent::Image { .. } => {
                if let Some(hash) = item.extract_image_hash() {
                    self.last_pasted_image_hash = Some(hash);
                }
                self.last_pasted_text = None;
            }
        }
    }

    /// Mark a specific text as pasted (to prevent it from appearing in history)
    /// Used for emojis/special insertions
    pub fn mark_text_as_pasted(&mut self, text: &str) {
        self.last_pasted_text = Some(text.to_string());
        self.last_added_text_hash = Some(calculate_hash(&text));
    }

    pub fn paste_item(&mut self, item: &ClipboardItem) -> Result<(), String> {
        // 1. Prevent loop: Mark as pasted before OS action
        self.mark_as_pasted(item);

        // 2. Write content to OS clipboard
        let mut clipboard = get_system_clipboard()?;

        match &item.content {
            ClipboardContent::Text(text) => {
                clipboard.set_text(text).map_err(|e| e.to_string())?;
            }
            ClipboardContent::RichText { plain, html } => {
                // Set HTML with plain text as fallback - this preserves formatting
                clipboard
                    .set_html(html, Some(plain))
                    .map_err(|e| e.to_string())?;
            }
            ClipboardContent::Image { .. } => {
                let (width, height, rgba) = self.full_image_data(item)?;
                let image_data = ImageData {
                    width: width as usize,
                    height: height as usize,
                    bytes: rgba.into(),
                };
                clipboard.set_image(image_data).map_err(|e| e.to_string())?;
            }
        }

        // 3. Simulate User Input
        self.simulate_paste_action()?;

        // 4. Move item to top of history so it's easily accessible for repeated use
        self.move_item_to_top(&item.id);

        Ok(())
    }

    fn simulate_paste_action(&self) -> Result<(), String> {
        // Wait for clipboard write to settle
        thread::sleep(Duration::from_millis(60));

        // Trigger keystroke
        crate::input_simulator::simulate_paste_keystroke()?;

        // Wait for the target app to process the paste
        thread::sleep(Duration::from_millis(250));

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    /// Returns a fresh, isolated history file path under the system temp dir.
    fn temp_history_path(name: &str) -> PathBuf {
        let dir = temp_dir().join(format!("penguinclip_test_{}", name));
        let _ = fs::remove_dir_all(&dir);
        dir.join("history.json")
    }

    #[test]
    fn test_history_round_trips_through_disk() {
        let path = temp_history_path("roundtrip");

        let mut manager = ClipboardManager::new(path.clone(), 50);
        manager.add_text("hello world".to_string(), None);
        manager.add_text("second item".to_string(), None);

        // A fresh manager pointed at the same file must observe what we saved.
        let reloaded = ClipboardManager::new(path, 50);
        let history = reloaded.get_history();

        assert_eq!(history.len(), 2);
        // Newest non-pinned item sits at the top.
        assert!(
            matches!(&history[0].content, ClipboardContent::Text(t) if t == "second item"),
            "expected newest item first, got {:?}",
            history[0].content
        );
    }

    #[test]
    fn test_save_leaves_no_temp_file_behind() {
        let path = temp_history_path("notemp");

        let mut manager = ClipboardManager::new(path.clone(), 50);
        manager.add_text("persisted".to_string(), None);

        let dir = path.parent().unwrap();
        let leftovers: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|name| name != "history.json")
            .collect();

        assert!(
            leftovers.is_empty(),
            "expected only history.json, found stray files: {:?}",
            leftovers
        );
    }

    // --- Image blob storage helpers ---

    /// Builds an in-memory solid-color RGBA image of the given size.
    fn solid_image(width: usize, height: usize, rgba: [u8; 4]) -> ImageData<'static> {
        let mut bytes = Vec::with_capacity(width * height * 4);
        for _ in 0..(width * height) {
            bytes.extend_from_slice(&rgba);
        }
        ImageData {
            width,
            height,
            bytes: bytes.into(),
        }
    }

    /// Decodes a base64 PNG and returns its pixel dimensions.
    fn png_dims(b64: &str) -> (u32, u32) {
        let bytes = BASE64.decode(b64).expect("valid base64");
        let img = image::load_from_memory(&bytes).expect("valid png");
        (img.width(), img.height())
    }

    /// Encodes a solid image to a base64 PNG (legacy inline format).
    fn png_base64(width: usize, height: usize, rgba: [u8; 4]) -> String {
        let img = solid_image(width, height, rgba);
        let dynimg = DynamicImage::ImageRgba8(
            image::RgbaImage::from_raw(width as u32, height as u32, img.bytes.to_vec()).unwrap(),
        );
        let mut buffer = Cursor::new(Vec::new());
        dynimg.write_to(&mut buffer, ImageFormat::Png).unwrap();
        BASE64.encode(buffer.get_ref())
    }

    fn blobs_dir_of(path: &std::path::Path) -> PathBuf {
        path.parent().unwrap().join("blobs")
    }

    #[test]
    fn test_add_image_writes_blob_and_keeps_only_thumbnail() {
        let path = temp_history_path("image_blob");
        let mut manager = ClipboardManager::new(path.clone(), 50);

        let item = manager
            .add_image(solid_image(300, 200, [10, 20, 30, 255]), 0xABCDEF)
            .expect("image should be added");

        // Full-resolution pixels are persisted to the blob store, not history.json.
        let entries: Vec<_> = fs::read_dir(blobs_dir_of(&path))
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(entries.len(), 1, "expected exactly one blob file");

        match &item.content {
            ClipboardContent::Image {
                blob,
                base64,
                width,
                height,
            } => {
                assert!(blob.is_some(), "blob reference must be set");
                assert_eq!((*width, *height), (300, 200), "original dimensions kept");
                let (tw, th) = png_dims(base64);
                assert!(
                    tw.max(th) <= THUMBNAIL_MAX_DIM,
                    "stored base64 should be a downscaled thumbnail, got {}x{}",
                    tw,
                    th
                );
            }
            other => panic!("expected image content, got {:?}", other),
        }
    }

    #[test]
    fn test_full_image_data_reconstructs_original_resolution() {
        let path = temp_history_path("image_full");
        let mut manager = ClipboardManager::new(path, 50);

        let item = manager
            .add_image(solid_image(300, 200, [9, 9, 9, 255]), 0x1234)
            .unwrap();

        let (w, h, rgba) = manager
            .full_image_data(&item)
            .expect("should reconstruct full image from blob");
        assert_eq!((w, h), (300, 200));
        assert_eq!(rgba.len(), 300 * 200 * 4);
    }

    #[test]
    fn test_legacy_inline_image_migrates_to_blob_on_load() {
        let path = temp_history_path("image_migrate");
        fs::create_dir_all(path.parent().unwrap()).unwrap();

        let full_b64 = png_base64(300, 200, [5, 6, 7, 255]);
        let legacy = format!(
            r#"[{{"id":"legacy-1","content":{{"type":"Image","data":{{"base64":"{}","width":300,"height":200}}}},"timestamp":"2024-01-01T00:00:00Z","pinned":false,"favorited":false,"preview":"Image (300x200) #99"}}]"#,
            full_b64
        );
        fs::write(&path, legacy).unwrap();

        let manager = ClipboardManager::new(path.clone(), 50);
        let history = manager.get_history();
        assert_eq!(history.len(), 1);

        assert_eq!(
            fs::read_dir(blobs_dir_of(&path)).unwrap().count(),
            1,
            "legacy image should be extracted to the blob store"
        );
        match &history[0].content {
            ClipboardContent::Image { blob, base64, .. } => {
                assert!(blob.is_some(), "migrated item must reference a blob");
                let (tw, th) = png_dims(base64);
                assert!(
                    tw.max(th) <= THUMBNAIL_MAX_DIM,
                    "inline full image should be shrunk to a thumbnail on migration"
                );
            }
            _ => panic!("expected image"),
        }
    }

    // --- Image files copied from a file manager ---

    fn write_png_file(dir: &std::path::Path, name: &str, w: usize, h: usize) -> PathBuf {
        fs::create_dir_all(dir).unwrap();
        let bytes = BASE64
            .decode(png_base64(w, h, [10, 120, 200, 255]))
            .unwrap();
        let p = dir.join(name);
        fs::write(&p, bytes).unwrap();
        p
    }

    #[test]
    fn test_parse_image_file_path() {
        assert_eq!(
            parse_image_file_path("file:///tmp/a.png"),
            Some(PathBuf::from("/tmp/a.png"))
        );
        assert_eq!(
            parse_image_file_path("/tmp/a.jpg"),
            Some(PathBuf::from("/tmp/a.jpg"))
        );
        assert_eq!(
            parse_image_file_path("file:///tmp/a%20b.png"),
            Some(PathBuf::from("/tmp/a b.png")),
            "percent-encoded spaces should decode"
        );
        assert_eq!(
            parse_image_file_path("file:///tmp/a.png\r\n"),
            Some(PathBuf::from("/tmp/a.png")),
            "uri-list trailing newline should be ignored"
        );
        assert_eq!(parse_image_file_path("hello world"), None);
        assert_eq!(parse_image_file_path("file:///tmp/notes.txt"), None);
        assert_eq!(parse_image_file_path("/etc/hosts"), None);
    }

    #[test]
    fn test_copying_image_file_stores_image_with_thumbnail() {
        let path = temp_history_path("imgfile");
        let dir = path.parent().unwrap().to_path_buf();
        let img_path = write_png_file(&dir, "shot.png", 300, 200);

        let mut manager = ClipboardManager::new(path.clone(), 50);
        let uri = format!("file://{}", img_path.display());
        let item = manager
            .add_clipboard_text(uri, None)
            .expect("an image file should be stored");

        match &item.content {
            ClipboardContent::Image { blob, base64, .. } => {
                assert!(blob.is_some(), "stored as a blob-backed image");
                let (tw, th) = png_dims(base64);
                assert!(tw.max(th) <= THUMBNAIL_MAX_DIM, "a thumbnail is generated");
            }
            other => panic!("expected an Image item, got {:?}", other),
        }
        assert_eq!(fs::read_dir(blobs_dir_of(&path)).unwrap().count(), 1);
    }

    #[test]
    fn test_plain_text_still_stored_as_text() {
        let path = temp_history_path("textstays");
        let mut manager = ClipboardManager::new(path, 50);
        let item = manager
            .add_clipboard_text("just some text".to_string(), None)
            .unwrap();
        assert!(matches!(item.content, ClipboardContent::Text(_)));
    }

    #[test]
    fn test_missing_image_file_falls_back_to_text() {
        let path = temp_history_path("missingimg");
        let mut manager = ClipboardManager::new(path, 50);
        let item = manager
            .add_clipboard_text("file:///tmp/penguin_does_not_exist.png".to_string(), None)
            .expect("unreadable image path is kept as text");
        assert!(matches!(item.content, ClipboardContent::Text(_)));
    }

    #[test]
    fn test_gif_cache_uri_is_not_treated_as_image() {
        let path = temp_history_path("gifcache");
        let mut manager = ClipboardManager::new(path, 50);
        let uri = "file:///home/u/.local/share/penguinclip/gifs/abc.gif".to_string();
        assert!(
            manager.add_clipboard_text(uri, None).is_none(),
            "internal GIF cache URIs must not be recorded as images"
        );
        assert!(manager.get_history().is_empty());
    }

    // --- Privacy: sensitive-content exclusions ---

    #[test]
    fn test_excluded_pattern_blocks_matching_text() {
        let path = temp_history_path("exclude");
        let mut manager = ClipboardManager::new(path, 50);
        manager.set_excluded_patterns(&["secret".to_string(), r"\d{16}".to_string()]);

        assert!(
            manager
                .add_text("my secret note".to_string(), None)
                .is_none(),
            "text matching an exclusion pattern must not be stored"
        );
        assert!(
            manager
                .add_text("1234567812345678".to_string(), None)
                .is_none(),
            "card-like number should be excluded"
        );
        assert!(
            manager
                .add_text("ordinary text".to_string(), None)
                .is_some(),
            "non-matching text is stored as usual"
        );
        assert_eq!(manager.get_history().len(), 1);
    }

    #[test]
    fn test_invalid_excluded_pattern_is_ignored() {
        let path = temp_history_path("exclude_invalid");
        let mut manager = ClipboardManager::new(path, 50);
        // First pattern is invalid regex and should be skipped, not panic.
        manager.set_excluded_patterns(&["[unclosed".to_string(), "blocked".to_string()]);

        assert!(
            manager
                .add_text("this is blocked content".to_string(), None)
                .is_none(),
            "the valid pattern still applies"
        );
        assert!(
            manager.add_text("totally fine".to_string(), None).is_some(),
            "the invalid pattern is ignored, not treated as a wildcard"
        );
    }

    // --- Storage hygiene ---

    #[test]
    fn test_recopying_image_moves_to_top_without_duplicating() {
        let path = temp_history_path("img_dedup");
        let mut manager = ClipboardManager::new(path, 50);

        manager
            .add_image(solid_image(10, 10, [1, 0, 0, 255]), 0xA)
            .unwrap();
        manager
            .add_image(solid_image(10, 10, [0, 1, 0, 255]), 0xB)
            .unwrap();

        // Re-copy the older image (now not on top).
        let re = manager.add_image(solid_image(10, 10, [1, 0, 0, 255]), 0xA);
        assert!(re.is_some(), "re-copying a non-top image should re-add it");

        let history = manager.get_history();
        assert_eq!(
            history.len(),
            2,
            "no duplicate image entry should be created"
        );
        assert_eq!(
            history[0].extract_image_hash(),
            Some(0xA),
            "re-copied image moves to the top"
        );
        assert_eq!(history[1].extract_image_hash(), Some(0xB));
    }

    #[test]
    fn test_orphan_blobs_are_pruned_on_load() {
        let path = temp_history_path("orphan");
        let blobs = blobs_dir_of(&path);

        {
            let mut manager = ClipboardManager::new(path.clone(), 50);
            manager
                .add_image(solid_image(10, 10, [2, 0, 0, 255]), 0xC)
                .unwrap();
        }

        // Plant a stray blob that no history item references.
        fs::write(blobs.join("deadbeefdeadbeef.png"), b"orphan").unwrap();
        assert_eq!(fs::read_dir(&blobs).unwrap().count(), 2);

        // Reloading should sweep the orphan but keep the referenced blob.
        let manager = ClipboardManager::new(path, 50);
        assert_eq!(manager.get_history().len(), 1);

        let remaining: Vec<String> = fs::read_dir(&blobs)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            remaining.len(),
            1,
            "orphan blob should be pruned, found {:?}",
            remaining
        );
        assert!(
            !remaining.iter().any(|n| n.contains("deadbeef")),
            "the orphan specifically should be gone"
        );
    }

    // --- Corruption recovery ---

    #[test]
    fn test_corrupt_history_is_backed_up_and_recovers_empty() {
        let path = temp_history_path("corrupt");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"{ this is not valid json at all ]").unwrap();

        let manager = ClipboardManager::new(path.clone(), 50);
        assert!(
            manager.get_history().is_empty(),
            "a corrupt file should recover with an empty history, not crash"
        );

        let backups: Vec<String> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|name| name.contains(".corrupt-"))
            .collect();
        assert!(
            !backups.is_empty(),
            "the corrupt file should be preserved as a backup, got {:?}",
            backups
        );

        let status = manager
            .load_status()
            .expect("a corrupt load should report an actionable status");
        assert!(
            status.to_lowercase().contains("corrupt"),
            "status should explain the corruption, got: {}",
            status
        );
    }

    #[test]
    fn test_valid_history_reports_no_load_error() {
        let path = temp_history_path("valid_status");
        {
            let mut m = ClipboardManager::new(path.clone(), 50);
            m.add_text("hi".to_string(), None);
        }

        let reloaded = ClipboardManager::new(path, 50);
        assert!(reloaded.load_status().is_none(), "clean load => no status");
        assert_eq!(reloaded.get_history().len(), 1);
    }

    #[test]
    fn test_partial_corruption_keeps_valid_items() {
        let path = temp_history_path("partial");
        fs::create_dir_all(path.parent().unwrap()).unwrap();

        // A valid text item followed by a structurally broken entry.
        let json = r#"[
          {"id":"a","content":{"type":"Text","data":"keep me"},"timestamp":"2024-01-01T00:00:00Z","pinned":false,"favorited":false,"preview":"keep me"},
          {"id":"b","content":{"type":"Nonsense"},"timestamp":"not-a-date","preview":123}
        ]"#;
        fs::write(&path, json).unwrap();

        let manager = ClipboardManager::new(path, 50);
        let history = manager.get_history();
        assert_eq!(history.len(), 1, "the valid item should survive");
        assert!(
            matches!(&history[0].content, ClipboardContent::Text(t) if t == "keep me"),
            "the surviving item should be the valid one"
        );

        let status = manager
            .load_status()
            .expect("partial recovery should report a status");
        let lowered = status.to_lowercase();
        assert!(
            lowered.contains("recover") || lowered.contains("skip"),
            "status should explain partial recovery, got: {}",
            status
        );
    }

    #[test]
    fn test_deleting_image_removes_its_blob() {
        let path = temp_history_path("image_delete");
        let mut manager = ClipboardManager::new(path.clone(), 50);

        let item = manager
            .add_image(solid_image(120, 120, [1, 2, 3, 255]), 0x55)
            .unwrap();
        assert_eq!(fs::read_dir(blobs_dir_of(&path)).unwrap().count(), 1);

        manager.remove_item(&item.id);
        assert_eq!(
            fs::read_dir(blobs_dir_of(&path)).unwrap().count(),
            0,
            "blob should be cleaned up when its only referencing item is deleted"
        );
    }
}
