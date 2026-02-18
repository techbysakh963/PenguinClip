//! Focus Manager Module
//! Tracks and restores window focus for proper paste injection on X11.
//! Also provides X11 window activation using EWMH protocols.

use std::sync::atomic::{AtomicU32, Ordering};

use std::thread;

use std::time::{Duration, Instant};

use x11rb::connection::Connection;

use x11rb::protocol::xproto::{AtomEnum, ClientMessageEvent, ConnectionExt, EventMask, InputFocus};

/// Time to wait after restoring focus before allowing the paste to proceed
const FOCUS_RESTORE_DELAY: Duration = Duration::from_millis(150);

/// Stores the ID of the window that had focus before we opened
static LAST_FOCUSED_WINDOW: AtomicU32 = AtomicU32::new(0);

pub fn save_focused_window() {
    match get_x11_connection() {
        Ok(conn) => match conn.get_input_focus() {
            Ok(cookie) => match cookie.reply() {
                Ok(reply) => {
                    let window_id = reply.focus;
                    LAST_FOCUSED_WINDOW.store(window_id, Ordering::SeqCst);
                    eprintln!("[FocusManager] Saved focused window: {}", window_id);
                }
                Err(e) => eprintln!("[FocusManager] Failed to get focus reply: {}", e),
            },
            Err(e) => eprintln!("[FocusManager] Failed to request input focus: {}", e),
        },
        Err(e) => eprintln!("[FocusManager] X11 Connection failed: {}", e),
    }
}

pub fn restore_focused_window() -> Result<(), String> {
    let window_id = LAST_FOCUSED_WINDOW.load(Ordering::SeqCst);

    if window_id == 0 {
        return Err("No previous window saved".to_string());
    }

    eprintln!("[FocusManager] Restoring focus to window: {}", window_id);

    let conn = get_x11_connection()?;

    conn.set_input_focus(InputFocus::PARENT, window_id, x11rb::CURRENT_TIME)
        .map_err(|e| format!("Set focus failed: {}", e))?;

    conn.flush().map_err(|e| format!("Flush failed: {}", e))?;

    // Small delay to ensure the Window Manager processes the focus change
    // before we attempt to simulate keystrokes
    thread::sleep(FOCUS_RESTORE_DELAY);

    Ok(())
}

pub fn get_focused_window() -> Option<u32> {
    let conn = get_x11_connection().ok()?;

    // Split the chain to satisfy the borrow checker (fix for E0597)
    let cookie = conn.get_input_focus().ok()?;
    let reply = cookie.reply().ok()?;

    Some(reply.focus)
}

/// Helper to establish X11 connection
fn get_x11_connection() -> Result<impl Connection, String> {
    x11rb::connect(None)
        .map(|(conn, _)| conn)
        .map_err(|e| format!("X11 connect failed: {}", e))
}

// =============================================================================
// X11 Window Activation (EWMH compliant)
// =============================================================================

/// Maximum time to wait for window to be mapped
const WINDOW_MAP_TIMEOUT: Duration = Duration::from_millis(500);

/// Polling interval when waiting for window
const WINDOW_MAP_POLL_INTERVAL: Duration = Duration::from_millis(10);

/// Activates an X11 window using the EWMH _NET_ACTIVE_WINDOW protocol.
/// This is the proper way to request focus and is respected by window managers
/// even with Focus Stealing Prevention enabled.
///
/// # Arguments
/// * `window_id` - The X11 window ID to activate
///
/// # Returns
/// * `Ok(())` if the activation message was sent successfully
/// * `Err(String)` if there was an error
pub fn x11_activate_window_by_id(window_id: u32) -> Result<(), String> {
    let (conn, screen_num) =
        x11rb::connect(None).map_err(|e| format!("X11 connect failed: {}", e))?;

    let screen = conn
        .setup()
        .roots
        .get(screen_num)
        .ok_or("Failed to get screen")?;
    let root = screen.root;

    // Get _NET_ACTIVE_WINDOW atom
    let net_active_window = conn
        .intern_atom(false, b"_NET_ACTIVE_WINDOW")
        .map_err(|e| format!("Failed to intern atom: {}", e))?
        .reply()
        .map_err(|e| format!("Failed to get atom reply: {}", e))?
        .atom;

    // Create the client message event
    // Data format for _NET_ACTIVE_WINDOW:
    // data[0] = source indication (1 = from application, 2 = from pager)
    // data[1] = timestamp (0 = current time)
    // data[2] = requestor's currently active window (0 if none)
    let event = ClientMessageEvent {
        response_type: 33, // ClientMessage
        format: 32,
        sequence: 0,
        window: window_id,
        type_: net_active_window,
        data: [1, 0, 0, 0, 0].into(), // source=1 (application request)
    };

    // Send to root window with SubstructureRedirect | SubstructureNotify
    conn.send_event(
        false,
        root,
        EventMask::SUBSTRUCTURE_REDIRECT | EventMask::SUBSTRUCTURE_NOTIFY,
        event,
    )
    .map_err(|e| format!("Failed to send event: {}", e))?;

    conn.flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;

    eprintln!(
        "[FocusManager] Sent _NET_ACTIVE_WINDOW for window {}",
        window_id
    );
    Ok(())
}

/// Waits for a window with the given title to appear and be mapped.
/// Uses polling with timeout instead of a fixed sleep.
///
/// # Arguments
/// * `title` - The window title to search for (substring match)
/// * `timeout` - Maximum time to wait
///
/// # Returns
/// * `Some(window_id)` if found within timeout
/// * `None` if timeout exceeded
pub fn wait_for_window_by_title(title: &str, timeout: Duration) -> Option<u32> {
    let start = Instant::now();

    while start.elapsed() < timeout {
        if let Some(window_id) = find_window_by_title(title) {
            eprintln!(
                "[FocusManager] Found window '{}' with ID {} after {:?}",
                title,
                window_id,
                start.elapsed()
            );
            return Some(window_id);
        }
        thread::sleep(WINDOW_MAP_POLL_INTERVAL);
    }

    eprintln!("[FocusManager] Timeout waiting for window '{}'", title);
    None
}

/// Finds a window by its title using X11 primitives.
/// This is more reliable than xdotool as it directly queries the X server.
fn find_window_by_title(title: &str) -> Option<u32> {
    let (conn, screen_num) = x11rb::connect(None).ok()?;
    let screen = conn.setup().roots.get(screen_num)?;
    let root = screen.root;

    // Get atoms we need
    let net_client_list = conn
        .intern_atom(false, b"_NET_CLIENT_LIST")
        .ok()?
        .reply()
        .ok()?
        .atom;

    let net_wm_name = conn
        .intern_atom(false, b"_NET_WM_NAME")
        .ok()?
        .reply()
        .ok()?
        .atom;

    let utf8_string = conn
        .intern_atom(false, b"UTF8_STRING")
        .ok()?
        .reply()
        .ok()?
        .atom;

    // Get list of all client windows
    let client_list = conn
        .get_property(false, root, net_client_list, AtomEnum::WINDOW, 0, 1024)
        .ok()?
        .reply()
        .ok()?;

    let windows: Vec<u32> = client_list
        .value32()
        .map(|iter| iter.collect())
        .unwrap_or_default();

    // Search each window for matching title
    for window in windows {
        // Try _NET_WM_NAME first (UTF-8)
        if let Ok(cookie) = conn.get_property(false, window, net_wm_name, utf8_string, 0, 256) {
            if let Ok(reply) = cookie.reply() {
                if let Ok(name) = String::from_utf8(reply.value) {
                    if name.contains(title) {
                        return Some(window);
                    }
                }
            }
        }

        // Fall back to WM_NAME (legacy)
        if let Ok(cookie) =
            conn.get_property(false, window, AtomEnum::WM_NAME, AtomEnum::STRING, 0, 256)
        {
            if let Ok(reply) = cookie.reply() {
                if let Ok(name) = String::from_utf8(reply.value) {
                    if name.contains(title) {
                        return Some(window);
                    }
                }
            }
        }
    }

    None
}

/// High-level function to activate a window by title.
/// Waits for the window to appear, then activates it using EWMH.
///
/// # Arguments
/// * `title` - The window title to search for
///
/// # Returns
/// * `Ok(())` if activation was successful
/// * `Err(String)` if window not found or activation failed
pub fn x11_activate_window_by_title(title: &str) -> Result<(), String> {
    let window_id = wait_for_window_by_title(title, WINDOW_MAP_TIMEOUT)
        .ok_or_else(|| format!("Window '{}' not found within timeout", title))?;

    x11_activate_window_by_id(window_id)?;

    // Small delay to let the WM process the activation
    thread::sleep(Duration::from_millis(20));

    Ok(())
}

/// Checks if the currently focused X11 window is a terminal emulator.
/// Queries WM_CLASS of the focused window and matches against known terminals.
pub fn is_focused_window_terminal() -> bool {
    // First try xdotool (works even when X11 direct connection is tricky)
    if let Ok(result) = is_terminal_via_xdotool() {
        return result;
    }

    // Fallback: query X11 WM_CLASS directly
    is_terminal_via_x11().unwrap_or(false)
}

/// Known terminal WM_CLASS values (lowercase for comparison)
const TERMINAL_WM_CLASSES: &[&str] = &[
    "gnome-terminal",
    "konsole",
    "xterm",
    "xfce4-terminal",
    "alacritty",
    "kitty",
    "terminator",
    "tilix",
    "urxvt",
    "rxvt",
    "lxterminal",
    "mate-terminal",
    "st",
    "foot",
    "wezterm",
    "sakura",
    "terminology",
    "guake",
    "tilda",
    "yakuake",
    "cool-retro-term",
    "eterm",
    "hyper",
    "tabby",
    "terminal",
    "deepin-terminal",
    "qterminal",
    "termite",
    "roxterm",
    "kgx",                // GNOME Console
    "org.gnome.console",  // GNOME Console flatpak
    "org.gnome.terminal", // GNOME Terminal flatpak
    "blackbox",           // Black Box terminal
    "ptyxis",             // GNOME Ptyxis terminal
];

/// Get WM_CLASS using xdotool to get window ID, then xprop to read WM_CLASS
fn is_terminal_via_xdotool() -> Result<bool, String> {
    // Step 1: Get active window ID via xdotool
    let id_output = std::process::Command::new("xdotool")
        .arg("getactivewindow")
        .output()
        .map_err(|e| format!("xdotool getactivewindow failed: {}", e))?;

    if !id_output.status.success() {
        return Err("xdotool getactivewindow failed".to_string());
    }

    let window_id = String::from_utf8_lossy(&id_output.stdout)
        .trim()
        .to_string();
    if window_id.is_empty() {
        return Err("xdotool returned empty window ID".to_string());
    }

    // Step 2: Get WM_CLASS via xprop
    let prop_output = std::process::Command::new("xprop")
        .args(["-id", &window_id, "WM_CLASS"])
        .output()
        .map_err(|e| format!("xprop failed: {}", e))?;

    if !prop_output.status.success() {
        return Err("xprop WM_CLASS query failed".to_string());
    }

    let wm_class = String::from_utf8_lossy(&prop_output.stdout).to_lowercase();
    eprintln!(
        "[FocusManager] Focused window WM_CLASS (xprop): {}",
        wm_class.trim()
    );

    Ok(TERMINAL_WM_CLASSES.iter().any(|t| wm_class.contains(t)))
}

/// Get WM_CLASS by querying X11 directly, walking up parent windows if needed
fn is_terminal_via_x11() -> Result<bool, String> {
    let conn = get_x11_connection()?;
    let focused = {
        let cookie = conn
            .get_input_focus()
            .map_err(|e| format!("get_input_focus: {}", e))?;
        let reply = cookie.reply().map_err(|e| format!("focus reply: {}", e))?;
        reply.focus
    };

    if focused == 0 {
        return Ok(false);
    }

    // Try the focused window and its parents (focused window may be a child without WM_CLASS)
    let mut window = focused;
    for _ in 0..10 {
        // Query WM_CLASS property (type STRING)
        let reply = conn
            .get_property(
                false,
                window,
                x11rb::protocol::xproto::AtomEnum::WM_CLASS,
                x11rb::protocol::xproto::AtomEnum::STRING,
                0,
                256,
            )
            .map_err(|e| format!("get_property WM_CLASS: {}", e))?
            .reply()
            .map_err(|e| format!("WM_CLASS reply: {}", e))?;

        if !reply.value.is_empty() {
            // WM_CLASS is two null-terminated strings: instance\0class\0
            let wm_class_raw = String::from_utf8_lossy(&reply.value).to_lowercase();
            eprintln!(
                "[FocusManager] Window {} WM_CLASS (x11): {}",
                window, wm_class_raw
            );

            if TERMINAL_WM_CLASSES.iter().any(|t| wm_class_raw.contains(t)) {
                return Ok(true);
            }
            // Found a WM_CLASS but it's not a terminal
            return Ok(false);
        }

        // No WM_CLASS on this window, try parent
        let tree = conn
            .query_tree(window)
            .map_err(|e| format!("query_tree: {}", e))?
            .reply()
            .map_err(|e| format!("query_tree reply: {}", e))?;

        if tree.parent == 0 || tree.parent == tree.root {
            break; // Reached root
        }
        window = tree.parent;
    }

    eprintln!(
        "[FocusManager] Could not find WM_CLASS for focused window {}",
        focused
    );
    Ok(false)
}

/// Alternative activation that sets input focus directly.
/// Use this as a fallback if _NET_ACTIVE_WINDOW doesn't work.
pub fn x11_force_input_focus(window_id: u32) -> Result<(), String> {
    let (conn, _) = x11rb::connect(None).map_err(|e| format!("X11 connect failed: {}", e))?;

    // Set input focus with PointerRoot revert mode
    conn.set_input_focus(InputFocus::POINTER_ROOT, window_id, x11rb::CURRENT_TIME)
        .map_err(|e| format!("set_input_focus failed: {}", e))?;

    conn.flush().map_err(|e| format!("Flush failed: {}", e))?;

    eprintln!("[FocusManager] Forced input focus to window {}", window_id);
    Ok(())
}

/// Combined activation strategy that tries multiple methods.
/// This is the most robust approach for X11 focus acquisition.
pub fn x11_robust_activate(title: &str) -> Result<(), String> {
    // Step 1: Wait for window to appear in _NET_CLIENT_LIST
    let window_id = wait_for_window_by_title(title, WINDOW_MAP_TIMEOUT)
        .ok_or_else(|| format!("Window '{}' not found", title))?;

    // Step 2: Try EWMH _NET_ACTIVE_WINDOW (preferred, WM-friendly)
    if let Err(e) = x11_activate_window_by_id(window_id) {
        eprintln!(
            "[FocusManager] EWMH activation failed: {}, trying fallback",
            e
        );
    }

    // Step 3: Small delay for WM to process
    thread::sleep(Duration::from_millis(30));

    // Step 4: Verify focus was acquired, force if not
    match get_focused_window() {
        Some(current_focus) => {
            if current_focus != window_id {
                eprintln!("[FocusManager] Focus not acquired, forcing input focus");
                x11_force_input_focus(window_id)?;
            }
        }
        None => {
            eprintln!(
                "[FocusManager] Could not determine focused window after EWMH activation; forcing input focus as fallback"
            );
            x11_force_input_focus(window_id)?;
        }
    }

    Ok(())
}
