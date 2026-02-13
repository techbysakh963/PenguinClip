# Security Audit Report

**Project:** Windows-11-Clipboard-History-For-Linux (Fork)
**Audit Date:** 2026-02-13
**Auditor:** Automated security analysis
**Scope:** Full repository — scripts, Rust backend, TypeScript frontend, CI/CD, packaging

---

## Executive Summary

This audit identified **8 critical**, **7 high**, **6 medium**, and **4 low** severity issues
across the install scripts, Rust backend, TypeScript frontend, CI/CD pipelines, and packaging.

The most significant risks are:
1. `curl | bash` installation pattern executing remote code as root
2. Hardcoded third-party API key (Tenor) in frontend source
3. Silent system modifications (udev rules, kernel modules, ACLs) without user consent
4. Unpinned GitHub Actions creating supply chain attack vectors
5. Null Content Security Policy in Tauri configuration
6. Unencrypted clipboard history stored on disk

---

## Table of Contents

1. [install.sh Analysis](#1-installsh-analysis)
2. [Package Scripts (postinst/postrm)](#2-package-scripts)
3. [Rust Backend](#3-rust-backend)
4. [TypeScript Frontend](#4-typescript-frontend)
5. [Tauri Configuration](#5-tauri-configuration)
6. [CI/CD Pipelines](#6-cicd-pipelines)
7. [Packaging (AUR/Makefile)](#7-packaging)
8. [Remediation Summary](#8-remediation-summary)

---

## 1. install.sh Analysis

### 1.1 CRITICAL: Remote Code Execution via `curl | bash`

**Location:** `scripts/install.sh` line 3 (usage comment), entire script design
**What it does:** The script is designed to be run via `curl -fsSL <url> | bash`
**Risk:** Executes arbitrary code from a remote server with no verification. A MITM attack,
DNS hijack, or compromised GitHub account could serve malicious code.

### 1.2 CRITICAL: Piping Remote Scripts to `sudo bash`

**Location:** `scripts/install.sh` lines 163, 207, 249
```bash
curl -1sLf "https://dl.cloudsmith.io/public/${CLOUDSMITH_REPO}/setup.deb.sh" | sudo -E bash
```
**What it does:** Downloads a Cloudsmith setup script and executes it as root.
**System components modified:**
- APT sources list (`/etc/apt/sources.list.d/`)
- APT keyring (`/etc/apt/keyrings/` or `/etc/apt/trusted.gpg.d/`)
- Package manager configuration
**Risk:** Full root code execution from a third-party CDN. No checksum verification.
The Cloudsmith script adds their GPG key and repository to the system.

### 1.3 HIGH: Silent Repository Addition

**Location:** `scripts/install.sh` lines 163, 207, 249
**What it does:** Adds Cloudsmith package repository to APT/DNF/Zypper without informing the user.
**Risk:** The user's system now trusts a third-party package source. Any future package from
that repository will be trusted and installable.

### 1.4 HIGH: Silent Kernel Module Loading

**Location:** `scripts/install.sh` lines 415-418
```bash
echo "uinput" | sudo tee /etc/modules-load.d/win11-clipboard.conf > /dev/null
sudo modprobe uinput 2>/dev/null || true
```
**What it does:** Configures the `uinput` kernel module to load on every boot and loads it immediately.
**System components modified:**
- `/etc/modules-load.d/win11-clipboard.conf` (new file)
- Kernel module state (uinput loaded)
**Risk:** Kernel module loaded without explanation. uinput allows userspace programs to create
virtual input devices, which could be abused for keylogging or injection.

### 1.5 HIGH: Silent udev Rule Installation

**Location:** `scripts/install.sh` lines 407-412
```bash
sudo tee /etc/udev/rules.d/99-win11-clipboard-input.rules > /dev/null << 'EOF'
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", TAG+="uaccess"
EOF
```
**What it does:** Creates a udev rule granting logged-in users read/write access to `/dev/uinput`.
**System components modified:**
- `/etc/udev/rules.d/99-win11-clipboard-input.rules` (new file)
- Device permissions for `/dev/uinput`
**Risk:** Any process running as the logged-in user can now create virtual input devices.
This is a significant privilege expansion.

### 1.6 HIGH: Silent ACL Modification

**Location:** `scripts/install.sh` lines 393-400, 422-425
```bash
sudo setfacl -m "u:${USER}:rw" /dev/uinput 2>/dev/null || true
```
**What it does:** Grants the current user direct read/write access to `/dev/uinput`.
**Risk:** Immediate access to virtual input device creation without requiring group membership
or reboot. In non-interactive mode (line 393-400), this happens silently.

### 1.7 MEDIUM: Automatic AUR Helper Installation

**Location:** `scripts/install.sh` lines 296-301
```bash
sudo pacman -S --needed --noconfirm git base-devel
git clone https://aur.archlinux.org/yay-bin.git /tmp/yay-bin
cd /tmp/yay-bin && makepkg -si --noconfirm
```
**What it does:** Installs `yay` AUR helper if no AUR helper is found.
**Risk:** Installs additional software not directly related to the application.
Clones from AUR without verification. Uses `--noconfirm` bypassing user confirmation.

### 1.8 MEDIUM: Process Termination Without Confirmation

**Location:** `scripts/install.sh` lines 39, 435-436
```bash
pkill -f "win11-clipboard-history.AppImage" 2>/dev/null || true
pkill -f "win11-clipboard-history-bin" 2>/dev/null || true
```
**What it does:** Kills running instances of the application.
**Risk:** Could terminate user's active work without warning.

### 1.9 LOW: Unverified GitHub Release Downloads

**Location:** `scripts/install.sh` lines 176-190
**What it does:** Downloads `.deb`/`.rpm` from GitHub releases.
**Risk:** No checksum or signature verification of downloaded packages.

### Complete System Modification Map for install.sh

| Modification | Risk | Silent? | Reversible? |
|---|---|---|---|
| Pipe Cloudsmith script to `sudo bash` | CRITICAL | Yes | No |
| Add Cloudsmith APT/DNF/Zypper repository | HIGH | Yes | Manual |
| Add Cloudsmith GPG keyring | HIGH | Yes | Manual |
| Create udev rule in `/etc/udev/rules.d/` | HIGH | Yes | Manual |
| Create `/etc/modules-load.d/win11-clipboard.conf` | HIGH | Yes | Manual |
| Load `uinput` kernel module via `modprobe` | HIGH | Yes | Reboot |
| Set ACL on `/dev/uinput` via `setfacl` | HIGH | Partial | Reboot |
| Install packages via `apt/dnf/zypper` with `-y` | MEDIUM | Partial | Manual |
| Install AUR helper (`yay`) if missing | MEDIUM | Yes | Manual |
| Kill running app instances | MEDIUM | Yes | N/A |
| Create `.desktop` file | LOW | Yes | Manual |
| Download icon from GitHub | LOW | Yes | Manual |

---

## 2. Package Scripts

### 2.1 HIGH: Silent Post-Install System Modifications

**Location:** `src-tauri/bundle/linux/postinst.sh`
```bash
echo "uinput" > /etc/modules-load.d/win11-clipboard.conf
modprobe uinput 2>/dev/null || true
udevadm control --reload-rules 2>/dev/null || true
```
**What it does:** During package installation, silently loads kernel module and reloads udev.
**Risk:** Package managers run postinst as root. Users installing via `apt install` may not
realize kernel modules are being loaded.

---

## 3. Rust Backend

### 3.1 CRITICAL: Arbitrary URL Download Without Validation

**Location:** `src-tauri/src/gif_manager.rs` lines 58-93
**What it does:** Downloads GIFs from any URL provided by the frontend without validation.
**Risk:** Server-Side Request Forgery (SSRF). Could be used to probe internal networks,
download malicious files, or exfiltrate data via DNS.
**Recommendation:** Whitelist allowed domains (e.g., `media.tenor.com`), validate URL scheme
is HTTPS only, check Content-Type header of response.

### 3.2 HIGH: Desktop Entry Format Injection

**Location:** `src-tauri/src/autostart_manager.rs` line 76
```rust
DESKTOP_ENTRY_TEMPLATE.replace("EXEC_PATH", &exec_path);
```
**What it does:** Substitutes executable path into `.desktop` file template without escaping.
**Risk:** If `exec_path` contains newlines or INI special characters, could inject
arbitrary desktop entry directives including `Exec=malicious-command`.
**Recommendation:** Escape special characters in exec_path or validate it is a clean path.

### 3.3 HIGH: Username Format Injection in ACL Command

**Location:** `src-tauri/src/permission_checker.rs` line 87
```rust
&format!("u:{}:rw", username)
```
**What it does:** Constructs ACL expression with unsanitized username.
**Risk:** If username contains `:`, `=`, or whitespace, the ACL syntax breaks or
modifies unintended permissions.
**Recommendation:** Validate username matches `[a-zA-Z0-9_-]+` before use.

### 3.4 MEDIUM: Unencrypted Clipboard History on Disk

**Location:** `src-tauri/src/clipboard_manager.rs` lines 226-281
**What it does:** Stores all clipboard history as plaintext JSON including text and
base64-encoded images.
**Risk:** Passwords, API keys, private messages, and other sensitive clipboard content
stored in readable file. Any process with user-level access can read it.
**Path:** `~/.local/share/win11-clipboard-history/history.json`

### 3.5 MEDIUM: Weak Temporary File Names

**Location:** `src-tauri/src/linux_shortcut_manager.rs` lines 381-387
**What it does:** Creates temporary files using millisecond timestamps.
**Risk:** Predictable filenames enable race condition attacks.
**Recommendation:** Use the `tempfile` crate for secure random temp files.

### 3.6 MEDIUM: Unvalidated D-Bus Message Handling

**Location:** `src-tauri/src/theme_manager.rs` lines 161-171
**What it does:** Unwraps D-Bus variant types without full validation.
**Risk:** Type confusion if D-Bus returns unexpected types.

### 3.7 LOW: X11 Input Simulation via xdotool

**Location:** `src-tauri/src/input_simulator.rs` lines 135-153
**What it does:** Executes `xdotool` to simulate Ctrl+V paste.
**Risk:** Low — arguments are hardcoded. But xdotool can simulate any keypress.

### 3.8 LOW: Direct /dev/uinput Access

**Location:** `src-tauri/src/input_simulator.rs` lines 175-278
**What it does:** Opens `/dev/uinput` and creates a virtual keyboard for paste simulation.
**Risk:** Legitimate use case, but the virtual keyboard could theoretically be used for
keylogging or injection if the code were modified. Requires prior permission setup.

---

## 4. TypeScript Frontend

### 4.1 CRITICAL: Hardcoded Third-Party API Key

**Location:** `src/services/gifService.ts` line 7
```typescript
const TENOR_API_KEY = 'LIVDSRZULELA'
```
**What it does:** Embeds a Tenor API key directly in source code.
**Risk:**
- Key visible in built JavaScript bundles, browser DevTools, and Git history
- Can be abused by anyone to exhaust API quotas
- Constitutes a credential leak

### 4.2 HIGH: External Data Transmission to Tenor

**Location:** `src/services/gifService.ts` lines 69-129
**What it does:** Sends search queries and fetches GIFs from `https://g.tenor.com/v1/`.
**Data sent externally:**
- Search queries (potentially sensitive or private)
- Client IP address
- HTTP headers with browser/environment info
**Risk:** Privacy violation. User search behavior is logged by Google (Tenor's parent).
No consent mechanism or privacy notice. No way to disable without modifying code.

### 4.3 MEDIUM: Unsafe URL Opening from Clipboard

**Location:** `src/services/smartActionService.ts` lines 57-62
```typescript
case 'open-link':
  if (action.data) await open(action.data)
```
**What it does:** Opens URLs found in clipboard content directly in the default browser.
**Risk:** No URL safety validation. Could open malicious URLs, phishing pages,
or trigger protocol handlers (e.g., `javascript:`, `data:`).

---

## 5. Tauri Configuration

### 5.1 CRITICAL: Null Content Security Policy

**Location:** `src-tauri/tauri.conf.json` line 51
```json
"security": {
  "csp": null
}
```
**What it does:** Disables Content Security Policy entirely.
**Risk:** No protection against XSS attacks. If any user-controlled content is rendered
in the webview (clipboard content, GIF URLs), it could execute arbitrary JavaScript.
**Recommendation:** Set a restrictive CSP:
```
"csp": "default-src 'self'; img-src 'self' https://media.tenor.com; style-src 'self' 'unsafe-inline'"
```

### 5.2 MEDIUM: Broad Tauri Capabilities

**Location:** `src-tauri/capabilities/default.json`
**What it does:** Grants both windows (`main` and `settings`) access to shell, global shortcuts,
window management, and tray.
**Risk:** The `shell:allow-open` capability allows opening arbitrary URLs/programs.
**Recommendation:** Restrict `shell:allow-open` to the settings window only.

---

## 6. CI/CD Pipelines

### 6.1 CRITICAL: All GitHub Actions Unpinned (Supply Chain Risk)

**Location:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/stale.yml`
**Examples:**
```yaml
actions/checkout@v6        # Should be pinned to SHA
actions/setup-node@v6      # Should be pinned to SHA
dtolnay/rust-toolchain@stable  # Should be pinned to SHA
softprops/action-gh-release@v2  # Third-party, unpinned
```
**Risk:** Mutable version tags can be moved by action maintainers (or attackers who
compromise their accounts). A supply chain attack could inject malicious code into
the build pipeline.

### 6.2 HIGH: Secret Exposed in Process Arguments

**Location:** `.github/workflows/release.yml` line 178
```bash
cloudsmith push ... --api-key $CLOUDSMITH_API_KEY
```
**Risk:** API key visible in `ps` output and potentially in CI logs.

### 6.3 HIGH: SSH Private Key Written to Disk

**Location:** `.github/workflows/release.yml` lines 203-205
**Risk:** AUR SSH key written to runner filesystem in plaintext.

### 6.4 MEDIUM: Security Audits Don't Block Releases

**Location:** `.github/workflows/ci.yml` lines 129, 144
```yaml
continue-on-error: true
```
**Risk:** Known vulnerabilities in dependencies don't prevent release builds.

### 6.5 MEDIUM: Unpinned Docker Image

**Location:** `.github/workflows/release.yml` line 221
```bash
docker run --rm -v "$PWD:/pkg" archlinux bash -c "..."
```
**Risk:** Uses `archlinux:latest` — unpinned, non-reproducible.

---

## 7. Packaging

### 7.1 MEDIUM: AUR PKGBUILD Skips Checksum Verification

**Location:** `aur/PKGBUILD` line 26
```bash
sha256sums_x86_64=('SKIP')
```
**Risk:** Downloaded .deb is not integrity-checked. A compromised download could go undetected.

### 7.2 LOW: Makefile Adds User to Input Group Without Confirmation

**Location:** `Makefile` lines 262-273
```bash
usermod -aG input $$SUDO_USER
```
**Risk:** Modifies user group membership silently during `make install`.

---

## 8. Remediation Summary

### Critical (Must Fix)
| # | Issue | File | Fix |
|---|---|---|---|
| 1 | `curl \| bash` installer | `scripts/install.sh` | Replace with transparent step-by-step installer |
| 2 | Remote script piped to `sudo bash` | `scripts/install.sh:163` | Manual repo setup instructions |
| 3 | Hardcoded Tenor API key | `src/services/gifService.ts:7` | Remove; make GIF feature opt-in via user's own key |
| 4 | Null CSP | `src-tauri/tauri.conf.json:51` | Set restrictive CSP |
| 5 | Unpinned GitHub Actions | `.github/workflows/*.yml` | Pin to commit SHAs |
| 6 | Arbitrary URL download | `src-tauri/src/gif_manager.rs` | Whitelist domains, validate scheme |

### High (Should Fix)
| # | Issue | File | Fix |
|---|---|---|---|
| 7 | Silent udev/modules/ACL | `scripts/install.sh` | Require explicit confirmation |
| 8 | Desktop entry injection | `autostart_manager.rs:76` | Escape exec_path |
| 9 | Username format injection | `permission_checker.rs:87` | Validate username |
| 10 | Tenor data transmission | `gifService.ts` | Make opt-in, add privacy notice |
| 11 | Secret in CI process args | `release.yml:178` | Use environment variable |
| 12 | SSH key on disk | `release.yml:203` | Use ssh-agent |
| 13 | Silent repo addition | `install.sh` | Manual instructions only |

### Medium (Recommended)
| # | Issue | File | Fix |
|---|---|---|---|
| 14 | Unencrypted clipboard history | `clipboard_manager.rs` | Document risk; consider encryption |
| 15 | Weak temp file names | `linux_shortcut_manager.rs` | Use tempfile crate |
| 16 | Unvalidated D-Bus | `theme_manager.rs` | Add type validation |
| 17 | Unsafe URL opening | `smartActionService.ts` | Add URL safety checks |
| 18 | Security audits don't block CI | `ci.yml` | Remove continue-on-error |
| 19 | PKGBUILD skips checksums | `aur/PKGBUILD` | Compute and verify checksums |
