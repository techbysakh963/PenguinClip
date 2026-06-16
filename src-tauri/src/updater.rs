//! Update checking.
//!
//! PenguinClip is distributed through AUR, AppImage, and `.deb`/`.rpm` packages,
//! so it does not self-update (that would fight the system package manager).
//! Instead this module checks the GitHub Releases API for a newer version and
//! reports it, leaving the actual update to the user's package manager or a
//! manual download. Network and parsing failures return actionable messages
//! rather than panicking.

use serde::Serialize;

const RELEASES_API: &str = "https://api.github.com/repos/techbysakh963/PenguinClip/releases/latest";
const REQUEST_TIMEOUT_SECS: u64 = 10;

/// Result of an update check, returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub release_notes: String,
}

/// Parses a version string ("v1.2.3", "1.2", "1.2.3-beta") into numeric parts,
/// ignoring a leading `v` and any pre-release/build metadata.
fn parse_version(s: &str) -> Vec<u64> {
    let s = s.trim();
    let s = s.strip_prefix('v').unwrap_or(s);
    let core = s.split(['-', '+']).next().unwrap_or(s);
    core.split('.')
        .map(|part| part.trim().parse::<u64>().unwrap_or(0))
        .collect()
}

/// Returns true if `latest` is a strictly newer version than `current`.
/// Comparison is numeric and component-wise, so 0.10.0 > 0.9.0.
pub fn is_newer(current: &str, latest: &str) -> bool {
    let cur = parse_version(current);
    let lat = parse_version(latest);
    for i in 0..cur.len().max(lat.len()) {
        let c = cur.get(i).copied().unwrap_or(0);
        let l = lat.get(i).copied().unwrap_or(0);
        if l != c {
            return l > c;
        }
    }
    false
}

/// Builds an [`UpdateInfo`] from a parsed GitHub release JSON object.
fn build_update_info(
    release: &serde_json::Value,
    current_version: &str,
) -> Result<UpdateInfo, String> {
    let latest_tag = release
        .get("tag_name")
        .and_then(|v| v.as_str())
        .ok_or("The update response did not include a version tag.")?;

    let latest_version = latest_tag.trim_start_matches('v').to_string();
    let release_url = release
        .get("html_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_notes = release
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(UpdateInfo {
        update_available: is_newer(current_version, latest_tag),
        current_version: current_version.to_string(),
        latest_version,
        release_url,
        release_notes,
    })
}

/// Checks GitHub for the latest release and compares it to `current_version`.
/// Blocking; call from a blocking task.
pub fn check_for_updates(current_version: &str) -> Result<UpdateInfo, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent(concat!("PenguinClip/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Could not create the update client: {}", e))?;

    let response = client
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| {
            format!(
                "Could not reach the update server. Check your connection. ({})",
                e
            )
        })?;

    if !response.status().is_success() {
        return Err(format!(
            "The update server returned an error ({}). Please try again later.",
            response.status()
        ));
    }

    let body = response
        .text()
        .map_err(|e| format!("Could not read the update response: {}", e))?;
    let release: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Could not parse the update response: {}", e))?;

    build_update_info(&release, current_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_basic() {
        assert!(is_newer("0.9.0", "0.9.1"));
        assert!(!is_newer("0.9.0", "0.9.0"));
        assert!(!is_newer("0.9.0", "0.8.9"));
    }

    #[test]
    fn test_is_newer_ignores_v_prefix() {
        assert!(is_newer("0.9.0", "v1.0.0"));
        assert!(!is_newer("v1.0.0", "1.0.0"));
    }

    #[test]
    fn test_is_newer_is_numeric_not_lexicographic() {
        // 10 > 9 numerically, even though "10" < "9" as strings.
        assert!(is_newer("0.9.0", "0.10.0"));
        assert!(!is_newer("0.10.0", "0.9.0"));
    }

    #[test]
    fn test_is_newer_treats_missing_components_as_zero() {
        assert!(!is_newer("1.0.0", "1.0"));
        assert!(is_newer("1.0", "1.0.1"));
    }

    #[test]
    fn test_is_newer_strips_prerelease_suffix() {
        assert!(is_newer("0.9.0", "0.9.1-beta"));
        assert!(!is_newer("0.9.0-rc1", "0.9.0"));
    }

    #[test]
    fn test_build_update_info_flags_available_update() {
        let release = serde_json::json!({
            "tag_name": "v1.2.0",
            "html_url": "https://example.com/release",
            "body": "notes"
        });
        let info = build_update_info(&release, "1.0.0").unwrap();
        assert!(info.update_available);
        assert_eq!(info.latest_version, "1.2.0");
        assert_eq!(info.release_url, "https://example.com/release");
    }

    #[test]
    fn test_build_update_info_same_version_no_update() {
        let release = serde_json::json!({ "tag_name": "v1.0.0", "html_url": "" });
        let info = build_update_info(&release, "1.0.0").unwrap();
        assert!(!info.update_available);
    }

    #[test]
    fn test_build_update_info_missing_tag_is_error() {
        let release = serde_json::json!({ "html_url": "x" });
        assert!(build_update_info(&release, "1.0.0").is_err());
    }
}
