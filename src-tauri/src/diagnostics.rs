//! Structured logging, startup/runtime diagnostics, and crash capture.
//!
//! Provides a small file logger behind the `log` facade (so the rest of the
//! code uses `log::info!` / `warn!` / `error!`), a panic hook that records
//! crashes, and a redaction-safe diagnostics report the user can export.
//!
//! Privacy: clipboard content is never logged. Only host/session metadata and
//! operational messages (ids, sizes, errors) are written, so the log and the
//! exported report are safe to share.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use chrono::Utc;
use log::{LevelFilter, Metadata, Record};

const LOG_FILE_NAME: &str = "penguinclip.log";
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024; // rotate at 2 MiB
const DEFAULT_RECENT_LINES: usize = 200;

/// Directory holding log files (under the app data dir).
pub fn log_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("logs")
}

/// Path to the active log file.
pub fn log_file(data_dir: &Path) -> PathBuf {
    log_dir(data_dir).join(LOG_FILE_NAME)
}

/// Snapshot of the environment captured at startup. Contains no clipboard
/// content — only host/session metadata safe to log and export.
#[derive(Debug, Clone)]
pub struct StartupInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
    pub session: String,
    pub desktop: String,
    pub data_dir: String,
}

/// Collects environment metadata for diagnostics.
pub fn collect_startup_info(data_dir: &Path) -> StartupInfo {
    let session = if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        "Wayland"
    } else if std::env::var_os("DISPLAY").is_some() {
        "X11"
    } else {
        "Unknown"
    }
    .to_string();

    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_else(|_| "Unknown".to_string());

    StartupInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        session,
        desktop,
        data_dir: data_dir.display().to_string(),
    }
}

/// Renders a human-readable, shareable diagnostics report. `recent_log` is the
/// tail of the log file; by policy it never contains clipboard content.
pub fn build_report(info: &StartupInfo, recent_log: &str) -> String {
    let mut out = String::new();
    out.push_str("PenguinClip diagnostics report\n");
    out.push_str("==============================\n");
    out.push_str(&format!("version  : {}\n", info.version));
    out.push_str(&format!("os/arch  : {} / {}\n", info.os, info.arch));
    out.push_str(&format!("session  : {}\n", info.session));
    out.push_str(&format!("desktop  : {}\n", info.desktop));
    out.push_str(&format!("data dir : {}\n", info.data_dir));
    out.push_str(&format!("generated: {}\n", Utc::now().to_rfc3339()));
    out.push_str("\nRecent log (clipboard content is never logged):\n");
    out.push_str("----------------------------------------------\n");
    if recent_log.trim().is_empty() {
        out.push_str("(no log entries)\n");
    } else {
        out.push_str(recent_log);
        if !recent_log.ends_with('\n') {
            out.push('\n');
        }
    }
    out
}

/// Returns the last `max_lines` lines of the log file (empty if unreadable).
pub fn read_recent_log(path: &Path, max_lines: usize) -> String {
    let content = fs::read_to_string(path).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].join("\n")
}

/// Rotates the log to "<name>.1" once it grows past `max_bytes`, so the file
/// never grows unbounded. Returns true if a rotation happened.
pub fn rotate_if_needed(path: &Path, max_bytes: u64) -> bool {
    match fs::metadata(path) {
        Ok(meta) if meta.len() > max_bytes => {
            let rotated = path.with_extension("log.1");
            fs::rename(path, rotated).is_ok()
        }
        _ => false,
    }
}

// --- Logger backend ---

struct FileLogger {
    level: LevelFilter,
    file: Mutex<Option<File>>,
}

impl log::Log for FileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= self.level
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let line = format!(
            "{} [{:<5}] {}: {}\n",
            Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ"),
            record.level(),
            record.target(),
            record.args()
        );
        // Echo to stderr too (handy under journalctl / dev).
        eprint!("{}", line);
        if let Ok(mut guard) = self.file.lock() {
            if let Some(file) = guard.as_mut() {
                let _ = file.write_all(line.as_bytes());
            }
        }
    }

    fn flush(&self) {
        if let Ok(mut guard) = self.file.lock() {
            if let Some(file) = guard.as_mut() {
                let _ = file.flush();
            }
        }
    }
}

/// Picks a default log level: overridable via `PENGUINCLIP_LOG`, otherwise
/// Debug in debug builds and Info in release.
pub fn default_level() -> LevelFilter {
    match std::env::var("PENGUINCLIP_LOG").ok().as_deref() {
        Some("trace") => LevelFilter::Trace,
        Some("debug") => LevelFilter::Debug,
        Some("info") => LevelFilter::Info,
        Some("warn") => LevelFilter::Warn,
        Some("error") => LevelFilter::Error,
        Some("off") => LevelFilter::Off,
        _ if cfg!(debug_assertions) => LevelFilter::Debug,
        _ => LevelFilter::Info,
    }
}

/// Initializes the global file logger. Safe to call once at startup.
pub fn init(data_dir: &Path, level: LevelFilter) -> Result<PathBuf, String> {
    let dir = log_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("could not create log dir: {}", e))?;
    let path = dir.join(LOG_FILE_NAME);

    rotate_if_needed(&path, MAX_LOG_BYTES);

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("could not open log file: {}", e))?;

    let logger = FileLogger {
        level,
        file: Mutex::new(Some(file)),
    };
    log::set_boxed_logger(Box::new(logger)).map_err(|e| format!("could not set logger: {}", e))?;
    log::set_max_level(level);
    Ok(path)
}

/// Installs a panic hook that records the panic location and message to the log
/// before the default hook runs (crash information collection).
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "<non-string panic payload>".to_string());

        log::error!(target: "panic", "PANIC at {}: {}", location, message);
        default_hook(info);
    }));
}

/// Logs a one-line startup summary of the environment.
pub fn log_startup(info: &StartupInfo) {
    log::info!(
        target: "startup",
        "PenguinClip {} starting | os={} arch={} session={} desktop={} data_dir={}",
        info.version, info.os, info.arch, info.session, info.desktop, info.data_dir
    );
}

/// Builds the full diagnostics report for the current environment.
pub fn gather_report(data_dir: &Path) -> String {
    let info = collect_startup_info(data_dir);
    let recent = read_recent_log(&log_file(data_dir), DEFAULT_RECENT_LINES);
    build_report(&info, &recent)
}

/// Writes the diagnostics report to a timestamped file in the data dir and
/// returns its path.
pub fn export_report(data_dir: &Path) -> Result<PathBuf, String> {
    let report = gather_report(data_dir);
    let path = data_dir.join(format!(
        "penguinclip-diagnostics-{}.txt",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    fs::write(&path, report).map_err(|e| format!("could not write diagnostics file: {}", e))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    fn scratch(name: &str) -> PathBuf {
        let dir = temp_dir().join(format!("penguinclip_diag_{}", name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_rotate_only_when_over_limit() {
        let dir = scratch("rotate");
        let path = dir.join("penguinclip.log");

        fs::write(&path, vec![b'x'; 100]).unwrap();
        assert!(!rotate_if_needed(&path, 1000), "small file must not rotate");
        assert!(path.exists());

        fs::write(&path, vec![b'x'; 2000]).unwrap();
        assert!(rotate_if_needed(&path, 1000), "oversized file must rotate");
        assert!(!path.exists(), "active log moved aside after rotation");
        assert!(
            dir.join("penguinclip.log.1").exists(),
            "rotated file should exist"
        );
    }

    #[test]
    fn test_read_recent_log_returns_tail() {
        let dir = scratch("tail");
        let path = dir.join("penguinclip.log");
        let body: String = (0..10).map(|i| format!("line {i}\n")).collect();
        fs::write(&path, body).unwrap();

        let tail = read_recent_log(&path, 3);
        assert_eq!(tail, "line 7\nline 8\nline 9");
    }

    #[test]
    fn test_build_report_contains_env_and_log_without_extra() {
        let info = StartupInfo {
            version: "9.9.9".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            session: "Wayland".to_string(),
            desktop: "GNOME".to_string(),
            data_dir: "/home/u/.local/share/penguinclip".to_string(),
        };
        let report = build_report(&info, "2026-06-16T00:00:00Z [INFO ] startup: hello");

        assert!(report.contains("9.9.9"), "version present");
        assert!(report.contains("linux / x86_64"), "os/arch present");
        assert!(report.contains("Wayland"), "session present");
        assert!(report.contains("GNOME"), "desktop present");
        assert!(report.contains("startup: hello"), "log tail included");
        // The report must only contain what we passed — no surprise secrets.
        assert!(!report.contains("password"));
    }

    #[test]
    fn test_build_report_handles_empty_log() {
        let info = collect_startup_info(Path::new("/tmp/penguinclip"));
        let report = build_report(&info, "   \n  ");
        assert!(report.contains("(no log entries)"));
    }

    #[test]
    fn test_collect_startup_info_reports_version() {
        let info = collect_startup_info(Path::new("/tmp/penguinclip"));
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert!(!info.os.is_empty());
        assert!(!info.arch.is_empty());
    }
}
