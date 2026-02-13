<div align="center">

<img src="assets/logo.png" alt="PenguinClip Logo" width="150">

# PenguinClip

**A security-hardened clipboard history manager for Linux.**

Developed by **SAKH** | Hardened fork of [Windows-11-Clipboard-History-For-Linux](https://github.com/techbysakh963/Windows-11-Clipboard-History-For-Linux) by [gustavosett](https://github.com/gustavosett).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Rust](https://img.shields.io/badge/rust-1.77+-orange.svg)
![Tauri](https://img.shields.io/badge/tauri-v2-blue.svg)
![Platform](https://img.shields.io/badge/platform-linux-lightgrey.svg)
![Security](https://img.shields.io/badge/security-hardened-green.svg)

*Works on Wayland & X11.*

Built with Rust + Tauri v2 + React + Tailwind CSS

<img src="assets/screenshot.png" alt="PenguinClip Screenshot" width="600">

</div>

---

## What is PenguinClip?

PenguinClip is a **security-focused fork** of the excellent Windows-11-Clipboard-History-For-Linux project. It provides the same beautiful clipboard history UI while addressing security concerns for enterprise and privacy-conscious users.

### What Changed from Upstream

| Area | Before (Upstream) | After (PenguinClip) |
|---|---|---|
| **Installation** | `curl \| bash` with silent sudo | Step-by-step installer, explicit confirmation for every privileged action |
| **Package repos** | Silently adds Cloudsmith APT/DNF repo | No automatic repo addition; direct .deb/.rpm download only |
| **Permissions** | Silent udev/ACL/module changes | Fully explained, opt-in permission setup |
| **GIF Integration** | Hardcoded Tenor API key, always active | Opt-in; user must provide their own API key |
| **Content Security** | CSP disabled (`null`) | Restrictive CSP with domain whitelist |
| **CI/CD** | Unpinned GitHub Actions (supply chain risk) | All actions pinned to immutable commit SHAs |
| **URL Downloads** | Any URL accepted for GIF download | HTTPS-only with domain whitelist (SSRF prevention) |
| **Security Audits** | `continue-on-error: true` | Security audits block the build on failure |
| **API Keys** | Hardcoded in source | Removed; no embedded credentials |
| **Autostart** | Desktop entry injection possible | Input validation on executable paths |

For the complete audit, see [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

---

## Features

- **Wayland & X11 Support** - Uses OS-level shortcuts and `uinput` for paste simulation
- **Global Hotkey** - Press `Super+V` to open instantly
- **Smart Positioning** - Window follows your mouse cursor across monitors
- **Pinning** - Keep important items at the top
- **Rich Media** - Supports images, text, and more
- **GIF Integration** (opt-in) - Search and paste GIFs (requires your own Tenor API key)
- **Emoji Picker** - Built-in searchable emoji keyboard
- **Performance** - Native Rust backend, minimal resource usage
- **Privacy Focused** - History stored locally, no telemetry, no tracking
- **Setup Wizard** - First-run wizard for permissions, shortcuts, and autostart
- **Security Hardened** - See the audit report for details

---

## Installation

### Safe Installation (Recommended)

```bash
# 1. Download the installer
curl -fsSLO https://raw.githubusercontent.com/techbysakh963/PenguinClip/main/scripts/install.sh

# 2. Review it (important!)
less install.sh

# 3. Run it
bash install.sh
```

The installer will:
- Detect your distribution and architecture
- Download the correct package from GitHub Releases
- Show SHA256 checksums for verification
- Explain every privileged action before executing
- Require your explicit confirmation for each step

> **Note:** The installer **refuses** to run when piped from `curl`. This is intentional.

### Manual Installation

Download the latest release from the [Releases Page](https://github.com/techbysakh963/PenguinClip/releases).

<details>
<summary><b>Debian / Ubuntu</b></summary>

```bash
# Download the .deb from the releases page, then:
sudo apt install ./penguinclip_VERSION_amd64.deb

# Set up paste permissions (optional, for auto-paste):
sudo setfacl -m u:$USER:rw /dev/uinput
```

</details>

<details>
<summary><b>Fedora / RHEL</b></summary>

```bash
sudo dnf install ./penguinclip-VERSION-1.x86_64.rpm
sudo setfacl -m u:$USER:rw /dev/uinput
```

</details>

<details>
<summary><b>Arch Linux (AUR)</b></summary>

```bash
yay -S penguinclip-bin
# or
paru -S penguinclip-bin
```

</details>

<details>
<summary><b>AppImage (Universal)</b></summary>

```bash
chmod +x penguinclip_*.AppImage
sudo setfacl -m u:$USER:rw /dev/uinput
./penguinclip_*.AppImage
```

</details>

<details>
<summary><b>Build from Source</b></summary>

```bash
git clone https://github.com/techbysakh963/PenguinClip.git
cd PenguinClip
make deps
make rust
make node
source ~/.cargo/env
make build
sudo make install
```

</details>

---

## Permissions Explained

PenguinClip needs access to `/dev/uinput` to simulate keyboard input (Ctrl+V) for auto-paste. This is **optional** — without it, items are copied to clipboard but not auto-pasted.

**What the permission setup does:**
1. Creates a udev rule (`/etc/udev/rules.d/99-penguinclip-input.rules`) granting logged-in users access to `/dev/uinput`
2. Configures the `uinput` kernel module to load on boot
3. Applies an ACL for immediate access

**Security note:** This grants uinput access to all processes running as logged-in users. This is a standard requirement for input simulation tools and is the same mechanism used by other clipboard managers and automation tools.

For full details, see the installer's permission setup section or [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

---

## Usage

| Hotkey | Action |
| :--- | :--- |
| **`Super + V`** | Open Clipboard History |
| **`Esc`** | Close Window |
| **`Up / Down / Tab`** | Navigate Items |
| **`Enter`** | Paste Selected Item |

---

## GIF Integration (Opt-In)

GIF search is **disabled by default**. To enable it:

1. Get a free Tenor API key from [Google Tenor](https://developers.google.com/tenor/guides/quickstart)
2. Open Settings > GIF Integration
3. Enter your API key

**Privacy note:** When enabled, search queries are sent to Google's Tenor API. Your IP address and search terms are visible to Google.

---

## Security

- Full security audit: [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- Report vulnerabilities: See [.github/SECURITY.md](.github/SECURITY.md)
- No telemetry or analytics
- No external API calls without explicit opt-in
- All clipboard data stored locally
- Restrictive Content Security Policy
- All CI/CD actions pinned to immutable commit SHAs

---

## Attribution

PenguinClip is a hardened fork of [Windows-11-Clipboard-History-For-Linux](https://github.com/techbysakh963/Windows-11-Clipboard-History-For-Linux), originally created by [Gustavo Sett](https://github.com/gustavosett) and contributors.

The original project is licensed under the MIT License. This fork maintains the same license and preserves full attribution to the original authors.

See the [original contributors](https://github.com/techbysakh963/Windows-11-Clipboard-History-For-Linux#contributors-) for the complete list.

---

## Development

### Prerequisites

- Rust 1.77+
- Node.js 20+
- System build dependencies (`make deps`)

### Quick Start

```bash
git clone https://github.com/techbysakh963/PenguinClip.git
cd PenguinClip
make deps
make dev
```

### Commands

| Command | Description |
|---------|-------------|
| `make dev` | Development mode with hot reload |
| `make build` | Production build |
| `make install` | Install to system |
| `make uninstall` | Remove from system |
| `make lint` | Run linters |
| `make check-deps` | Verify dependencies |

---

## License

MIT License - See [LICENSE](LICENSE)

Original work: Copyright (c) 2024 Windows 11 Clipboard History For Linux Contributors
Fork modifications: Copyright (c) 2025-2026 PenguinClip Contributors (Developed by SAKH)
