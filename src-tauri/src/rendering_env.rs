//! Rendering Environment Detection Module
//!
//! Centralised detection of environments where transparency and rounded corners
//! must be disabled to avoid opacity rendering glitches (NVIDIA GPUs, AppImage builds).

use serde::Serialize;
use std::process::Command;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize)]
pub struct RenderingEnv {
    pub is_nvidia: bool,
    pub is_appimage: bool,
    pub transparency_disabled: bool,
    pub reason: String,
}

static RENDERING_ENV: OnceLock<RenderingEnv> = OnceLock::new();

fn detect_nvidia() -> bool {
    if std::env::var("IS_NVIDIA")
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return true;
    }

    if let Ok(modules) = std::fs::read_to_string("/proc/modules") {
        for line in modules.lines() {
            if let Some(name) = line.split_whitespace().next() {
                if name.to_ascii_lowercase().starts_with("nvidia") {
                    return true;
                }
            }
        }
    }

    if let Ok(output) = Command::new("lspci").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.lines().any(|l| {
                l.to_ascii_lowercase().contains("vga") && l.to_ascii_lowercase().contains("nvidia")
            }) {
                return true;
            }
        }
    }

    false
}

fn detect_appimage() -> bool {
    if std::env::var("IS_APPIMAGE")
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return true;
    }
    std::env::var("APPIMAGE")
        .map(|v| !v.is_empty())
        .unwrap_or(false)
}

pub fn init() {
    let env = RENDERING_ENV.get_or_init(|| {
        let is_nvidia = detect_nvidia();
        let is_appimage = detect_appimage();
        let transparency_disabled = is_nvidia || is_appimage;

        let reason = if is_nvidia && is_appimage {
            "Transparency is not supported on NVIDIA GPUs running via AppImage.".to_string()
        } else if is_nvidia {
            "Transparency is not supported on NVIDIA GPUs due to rendering issues.".to_string()
        } else if is_appimage {
            "Transparency is not supported when running as an AppImage.".to_string()
        } else {
            String::new()
        };

        RenderingEnv {
            is_nvidia,
            is_appimage,
            transparency_disabled,
            reason,
        }
    });

    if env.transparency_disabled {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        println!(
            "[RenderingEnv] WEBKIT_DISABLE_DMABUF_RENDERER=1 (NVIDIA={}, AppImage={})",
            env.is_nvidia, env.is_appimage
        );
    } else {
        println!("[RenderingEnv] Transparency enabled (no NVIDIA/AppImage detected)");
    }
}

pub fn get_rendering_env() -> &'static RenderingEnv {
    RENDERING_ENV
        .get()
        .expect("rendering_env::init() must be called before get_rendering_env()")
}

#[tauri::command]
pub fn get_rendering_environment() -> RenderingEnv {
    get_rendering_env().clone()
}
