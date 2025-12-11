//! Clipboard Manager Module
//! Handles clipboard monitoring, history storage, and paste injection

use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use uuid::Uuid;

/// Maximum number of items to store in history
const MAX_HISTORY_SIZE: usize = 50;

/// Content type for clipboard items
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum ClipboardContent {
    /// Plain text content
    Text(String),
    /// Image as base64 encoded PNG
    Image {
        base64: String,
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
    /// Preview text (for display)
    pub preview: String,
}

impl ClipboardItem {
    /// Create a new text item
    pub fn new_text(text: String) -> Self {
        let preview = if text.len() > 100 {
            format!("{}...", &text[..100])
        } else {
            text.clone()
        };

        Self {
            id: Uuid::new_v4().to_string(),
            content: ClipboardContent::Text(text),
            timestamp: Utc::now(),
            pinned: false,
            preview,
        }
    }

    /// Create a new image item
    pub fn new_image(base64: String, width: u32, height: u32) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content: ClipboardContent::Image {
                base64,
                width,
                height,
            },
            timestamp: Utc::now(),
            pinned: false,
            preview: format!("Image ({}x{})", width, height),
        }
    }
}

/// Manages clipboard operations and history
pub struct ClipboardManager {
    history: Vec<ClipboardItem>,
}

impl ClipboardManager {
    /// Create a new clipboard manager
    pub fn new() -> Self {
        Self {
            history: Vec::with_capacity(MAX_HISTORY_SIZE),
        }
    }

    /// Get a clipboard instance (creates new each time for thread safety)
    fn get_clipboard() -> Result<Clipboard, arboard::Error> {
        Clipboard::new()
    }

    /// Get current text from clipboard
    pub fn get_current_text(&mut self) -> Result<String, arboard::Error> {
        Self::get_clipboard()?.get_text()
    }

    /// Get current image from clipboard with hash for change detection
    pub fn get_current_image(
        &mut self,
    ) -> Result<Option<(ImageData<'static>, u64)>, arboard::Error> {
        let mut clipboard = Self::get_clipboard()?;
        match clipboard.get_image() {
            Ok(image) => {
                // Create hash from image data for comparison
                let mut hasher = DefaultHasher::new();
                image.bytes.hash(&mut hasher);
                let hash = hasher.finish();

                // Convert to owned data
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

    /// Add text to history
    pub fn add_text(&mut self, text: String) -> Option<ClipboardItem> {
        // Don't add empty strings or duplicates
        if text.trim().is_empty() {
            return None;
        }

        // Check for duplicates (non-pinned items only)
        if let Some(pos) = self.history.iter().position(|item| {
            !item.pinned && matches!(&item.content, ClipboardContent::Text(t) if t == &text)
        }) {
            // Remove the duplicate and add to top
            self.history.remove(pos);
        }

        let item = ClipboardItem::new_text(text);
        self.insert_item(item.clone());
        Some(item)
    }

    /// Add image to history
    pub fn add_image(&mut self, image_data: ImageData<'_>) -> Option<ClipboardItem> {
        // Convert to base64 PNG
        let img = DynamicImage::ImageRgba8(
            image::RgbaImage::from_raw(
                image_data.width as u32,
                image_data.height as u32,
                image_data.bytes.to_vec(),
            )
            .unwrap(),
        );

        let mut buffer = Cursor::new(Vec::new());
        if img.write_to(&mut buffer, ImageFormat::Png).is_err() {
            return None;
        }

        let base64 = BASE64.encode(buffer.get_ref());
        let item =
            ClipboardItem::new_image(base64, image_data.width as u32, image_data.height as u32);

        self.insert_item(item.clone());
        Some(item)
    }

    /// Insert an item at the top of history (respecting pinned items)
    fn insert_item(&mut self, item: ClipboardItem) {
        // Find the first non-pinned position
        let insert_pos = self.history.iter().position(|i| !i.pinned).unwrap_or(0);
        self.history.insert(insert_pos, item);

        // Trim to max size (remove from end, but preserve pinned items)
        while self.history.len() > MAX_HISTORY_SIZE {
            if let Some(pos) = self.history.iter().rposition(|i| !i.pinned) {
                self.history.remove(pos);
            } else {
                break; // All items are pinned, don't remove any
            }
        }
    }

    /// Get the full history
    pub fn get_history(&self) -> Vec<ClipboardItem> {
        self.history.clone()
    }

    /// Get a specific item by ID
    pub fn get_item(&self, id: &str) -> Option<&ClipboardItem> {
        self.history.iter().find(|item| item.id == id)
    }

    /// Clear all non-pinned history
    pub fn clear(&mut self) {
        self.history.retain(|item| item.pinned);
    }

    /// Remove a specific item
    pub fn remove_item(&mut self, id: &str) {
        self.history.retain(|item| item.id != id);
    }

    /// Toggle pin status
    pub fn toggle_pin(&mut self, id: &str) -> Option<ClipboardItem> {
        if let Some(item) = self.history.iter_mut().find(|i| i.id == id) {
            item.pinned = !item.pinned;
            return Some(item.clone());
        }
        None
    }

    /// Paste an item (write to clipboard and simulate Ctrl+V)
    pub fn paste_item(&self, item: &ClipboardItem) -> Result<(), String> {
        // Create a new clipboard instance for pasting
        let mut clipboard = Self::get_clipboard().map_err(|e| e.to_string())?;

        match &item.content {
            ClipboardContent::Text(text) => {
                clipboard.set_text(text).map_err(|e| e.to_string())?;
            }
            ClipboardContent::Image {
                base64,
                width,
                height,
            } => {
                let bytes = BASE64.decode(base64).map_err(|e| e.to_string())?;
                let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
                let rgba = img.to_rgba8();

                let image_data = ImageData {
                    width: *width as usize,
                    height: *height as usize,
                    bytes: rgba.into_raw().into(),
                };

                clipboard.set_image(image_data).map_err(|e| e.to_string())?;
            }
        }

        // Simulate Ctrl+V to paste
        simulate_paste()?;

        Ok(())
    }
}

/// Simulate Ctrl+V keypress for paste injection
#[cfg(target_os = "linux")]
fn simulate_paste() -> Result<(), String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};

    // Small delay to ensure clipboard is ready
    std::thread::sleep(std::time::Duration::from_millis(50));

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // Press Ctrl+V
    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| e.to_string())?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| e.to_string())?;
    enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn simulate_paste() -> Result<(), String> {
    // Fallback for other platforms - just set clipboard
    Ok(())
}

impl Default for ClipboardManager {
    fn default() -> Self {
        Self::new()
    }
}
