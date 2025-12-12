//! GIF Manager
//! Handles downloading GIFs and preparing them for clipboard paste
//!
//! IMPORTANT: Even though the app runs with GDK_BACKEND=x11 for window positioning,
//! the target apps (Discord, Chrome, etc.) run as native Wayland apps.
//! Therefore, we MUST use wl-copy (Wayland clipboard) for GIF paste to work.
//! For X11 sessions, we fall back to xclip.

use arboard::Clipboard;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Check if we're running on a Wayland session
fn is_wayland_session() -> bool {
    std::env::var("XDG_SESSION_TYPE")
        .map(|t| t == "wayland")
        .unwrap_or(false)
        || std::env::var("WAYLAND_DISPLAY").is_ok()
}

/// Get the temp directory for storing downloaded GIFs
fn get_gif_cache_dir() -> Result<PathBuf, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("win11-clipboard-history")
        .join("gifs");

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    Ok(cache_dir)
}

/// Download a GIF from URL and save to a temp file
/// Returns the path to the downloaded GIF file
pub fn download_gif_to_file(url: &str) -> Result<PathBuf, String> {
    eprintln!("[GifManager] Downloading GIF from: {}", url);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Failed to download GIF: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    eprintln!("[GifManager] Downloaded {} bytes", bytes.len());

    // Generate a unique filename based on URL hash
    let url_hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        url.hash(&mut hasher);
        hasher.finish()
    };

    let cache_dir = get_gif_cache_dir()?;
    let gif_path = cache_dir.join(format!("{}.gif", url_hash));

    let mut file =
        fs::File::create(&gif_path).map_err(|e| format!("Failed to create GIF file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write GIF file: {}", e))?;

    eprintln!("[GifManager] Saved GIF to: {:?}", gif_path);

    Ok(gif_path)
}

/// Copy GIF to clipboard using wl-copy (Wayland) with text/uri-list format
fn copy_gif_to_clipboard_wayland(gif_path: &Path) -> Result<(), String> {
    eprintln!("[GifManager] Copying GIF using wl-copy (Wayland) with text/uri-list...");

    // Get Wayland environment variables - these may not be inherited when running as root/sudo
    let wayland_display =
        std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".to_string());
    let xdg_runtime_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| {
        // Try to find the runtime dir for the actual user (not root)
        if let Ok(sudo_user) = std::env::var("SUDO_USER") {
            format!("/run/user/{}", get_uid_for_user(&sudo_user).unwrap_or(1000))
        } else if let Ok(user) = std::env::var("USER") {
            if user == "root" {
                // If running as root, try to find the first non-root user's runtime dir
                "/run/user/1000".to_string()
            } else {
                format!("/run/user/{}", get_uid_for_user(&user).unwrap_or(1000))
            }
        } else {
            "/run/user/1000".to_string()
        }
    });

    eprintln!(
        "[GifManager] Using WAYLAND_DISPLAY={}, XDG_RUNTIME_DIR={}",
        wayland_display, xdg_runtime_dir
    );

    // Use text/uri-list format - more universally accepted
    let file_uri = format!("file://{}\n", gif_path.to_string_lossy());

    let mut child = Command::new("wl-copy")
        .env("WAYLAND_DISPLAY", &wayland_display)
        .env("XDG_RUNTIME_DIR", &xdg_runtime_dir)
        .arg("--type")
        .arg("text/uri-list")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to spawn wl-copy: {}. Make sure wl-clipboard is installed.",
                e
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(file_uri.as_bytes())
            .map_err(|e| format!("Failed to write to wl-copy: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for wl-copy: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("wl-copy failed: {}", stderr));
    }

    eprintln!("[GifManager] Successfully set Wayland clipboard to text/uri-list");
    Ok(())
}

/// Get UID for a username
fn get_uid_for_user(username: &str) -> Option<u32> {
    let output = Command::new("id").arg("-u").arg(username).output().ok()?;

    if output.status.success() {
        String::from_utf8_lossy(&output.stdout).trim().parse().ok()
    } else {
        None
    }
}

/// Copy GIF to clipboard using xclip (X11) with text/uri-list format
fn copy_gif_to_clipboard_x11(gif_path: &Path) -> Result<(), String> {
    eprintln!("[GifManager] Copying GIF using xclip (X11) with text/uri-list...");

    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
    let file_uri = format!("file://{}", gif_path.to_string_lossy());

    // Kill any existing xclip processes we may have spawned before
    let _ = Command::new("pkill")
        .arg("-f")
        .arg("xclip -selection clipboard -t text/uri-list")
        .status();

    std::thread::sleep(std::time::Duration::from_millis(50));

    // Use setsid to fully detach xclip from our process tree
    // Use text/uri-list format for better compatibility
    let status = Command::new("setsid")
        .arg("-f") // Fork before setsid
        .arg("sh")
        .arg("-c")
        .arg("printf %s \"$1\" | DISPLAY=\"$2\" xclip -selection clipboard -t text/uri-list -loops 0")
        .arg("xclip_worker") // $0
        .arg(&file_uri)      // $1
        .arg(&display)       // $2
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| {
            format!(
                "Failed to spawn xclip: {}. Make sure xclip is installed.",
                e
            )
        })?;

    if !status.success() {
        return Err(format!("setsid command failed with status: {}", status));
    }

    eprintln!("[GifManager] xclip started via setsid with text/uri-list");

    // Give xclip a moment to register with the clipboard
    std::thread::sleep(std::time::Duration::from_millis(200));

    Ok(())
}

/// Copy a URL to clipboard as fallback
pub fn copy_url_to_clipboard(url: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

    clipboard
        .set_text(url)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    eprintln!("[GifManager] Set clipboard to URL (fallback): {}", url);

    Ok(())
}

/// Main function: Download GIF and prepare for pasting
pub fn paste_gif_to_clipboard(url: &str) -> Result<(), String> {
    let is_wayland = is_wayland_session();
    eprintln!(
        "[GifManager] Session type: {}",
        if is_wayland { "Wayland" } else { "X11" }
    );

    // Try to download the GIF file
    match download_gif_to_file(url) {
        Ok(gif_path) => {
            // Copy as image/gif using the appropriate clipboard tool
            let result = if is_wayland {
                copy_gif_to_clipboard_wayland(&gif_path)
            } else {
                copy_gif_to_clipboard_x11(&gif_path)
            };

            if result.is_ok() {
                eprintln!("[GifManager] Successfully set clipboard to GIF");
                return Ok(());
            }
            eprintln!(
                "[GifManager] Clipboard copy failed: {:?}, falling back to URL",
                result.err()
            );
        }
        Err(e) => {
            eprintln!("[GifManager] Download failed: {}, falling back to URL", e);
        }
    }

    // Fallback: just copy the URL
    copy_url_to_clipboard(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_gif() {
        let test_url = "https://media.tenor.com/images/test.gif";
        let _ = download_gif_to_file(test_url);
    }
}
