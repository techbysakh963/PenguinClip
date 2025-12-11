//! Global Hotkey Manager Module
//! Handles global keyboard shortcuts using rdev

use rdev::{listen, Event, EventType, Key};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

/// Actions triggered by hotkeys
#[derive(Debug, Clone, Copy)]
pub enum HotkeyAction {
    Toggle,
    Close,
}

/// Manages global hotkey listening
pub struct HotkeyManager {
    running: Arc<AtomicBool>,
    _handle: Option<JoinHandle<()>>,
}

impl HotkeyManager {
    /// Create a new hotkey manager with a callback for when the hotkey is pressed
    pub fn new<F>(callback: F) -> Self
    where
        F: Fn(HotkeyAction) + Send + Sync + 'static,
    {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();
        let callback = Arc::new(callback);

        let handle = thread::spawn(move || {
            // Use atomic bools for thread-safe state tracking
            let super_pressed = Arc::new(AtomicBool::new(false));
            let ctrl_pressed = Arc::new(AtomicBool::new(false));
            let alt_pressed = Arc::new(AtomicBool::new(false));

            let super_clone = super_pressed.clone();
            let ctrl_clone = ctrl_pressed.clone();
            let alt_clone = alt_pressed.clone();
            let callback_clone = callback.clone();
            let running_inner = running_clone.clone();

            // Use listen for better compatibility (doesn't require special permissions)
            let result = listen(move |event: Event| {
                if !running_inner.load(Ordering::SeqCst) {
                    return;
                }

                match event.event_type {
                    EventType::KeyPress(key) => {
                        match key {
                            Key::MetaLeft | Key::MetaRight => {
                                super_clone.store(true, Ordering::SeqCst);
                            }
                            Key::ControlLeft | Key::ControlRight => {
                                ctrl_clone.store(true, Ordering::SeqCst);
                            }
                            Key::Alt | Key::AltGr => {
                                alt_clone.store(true, Ordering::SeqCst);
                            }
                            Key::Escape => {
                                callback_clone(HotkeyAction::Close);
                            }
                            Key::KeyV => {
                                // Check for Super+V (Windows-like) or Ctrl+Alt+V (fallback)
                                let super_down = super_clone.load(Ordering::SeqCst);
                                let ctrl_down = ctrl_clone.load(Ordering::SeqCst);
                                let alt_down = alt_clone.load(Ordering::SeqCst);

                                if super_down || (ctrl_down && alt_down) {
                                    callback_clone(HotkeyAction::Toggle);
                                }
                            }
                            _ => {}
                        }
                    }
                    EventType::KeyRelease(key) => match key {
                        Key::MetaLeft | Key::MetaRight => {
                            super_clone.store(false, Ordering::SeqCst);
                        }
                        Key::ControlLeft | Key::ControlRight => {
                            ctrl_clone.store(false, Ordering::SeqCst);
                        }
                        Key::Alt | Key::AltGr => {
                            alt_clone.store(false, Ordering::SeqCst);
                        }
                        _ => {}
                    },
                    _ => {}
                }
            });

            if let Err(e) = result {
                eprintln!("Hotkey listener error: {:?}", e);
                eprintln!("Note: Global hotkeys may require the user to be in the 'input' group on Linux.");
                eprintln!("Run: sudo usermod -aG input $USER");
            }
        });

        Self {
            running,
            _handle: Some(handle),
        }
    }

    /// Stop the hotkey listener
    #[allow(dead_code)]
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

impl Drop for HotkeyManager {
    fn drop(&mut self) {
        self.stop();
    }
}
