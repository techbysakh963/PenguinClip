//! Windows 11 Clipboard History For Linux Library
//! This module re-exports the core functionality for use as a library

pub mod clipboard_manager;
pub mod hotkey_manager;

pub use clipboard_manager::{ClipboardContent, ClipboardItem, ClipboardManager};
pub use hotkey_manager::{HotkeyAction, HotkeyManager};
