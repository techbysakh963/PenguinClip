<div align="center">

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

PenguinClip is a **security-focused fork** of the excellent Windows-11-Clipboard-History-For-Linux project. It provides a beautiful clipboard history UI while addressing security concerns for enterprise and privacy-conscious users.

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

### Clipboard
- **Wayland & X11 Support** — Uses OS-level shortcuts and `uinput` for paste simulation
- **Global Hotkey** — Press `Super+V` to open instantly
- **Smart Positioning** — Window follows your mouse cursor across monitors
- **Pinning** — Keep important items at the top
- **Favorites** — Star items to save them in a dedicated Favorites tab
- **Categories** — Auto-detects content type (URL, Email, Code, Color, Phone) with colored badges
- **Rich Media** — Supports images, text, rich text, and more
- **Terminal Paste** — Automatically sends `Ctrl+Shift+V` when pasting into terminal emulators (30+ terminals supported)

### Extras
- **GIF Integration** (opt-in) — Search and paste GIFs (requires your own Tenor API key)
- **Emoji Picker** — Built-in searchable emoji keyboard (`Super+.`)
- **Kaomoji & Symbols** — Japanese emoticons and special characters

### Settings
- **Glassmorphism UI** — Settings window matches the clipboard's glass design
- **Setup Wizard** — First-run wizard for permissions, shortcuts, and autostart
- **Auto-delete** — Configurable history expiration (15 min to never)
- **History Size** — Adjustable max items (10–500)
- **Background Opacity** — Customize window transparency for both light and dark themes

### Under the Hood
- **Native Rust Backend** — Minimal resource usage
- **Privacy Focused** — History stored locally, no telemetry, no tracking
- **Security Hardened** — See the audit report for details

---

## Installation

### Download from Releases (Recommended)

Download the latest `.deb`, `.rpm`, or `.AppImage` from the [Releases Page](https://github.com/techbysakh963/PenguinClip/releases).

<details>
<summary><b>Debian / Ubuntu / Pop!_OS / Linux Mint</b></summary>

```bash
sudo apt install ./penguinclip_0.8.0_amd64.deb
```

</details>

<details>
<summary><b>Fedora / openSUSE / RHEL</b></summary>

```bash
sudo dnf install ./penguinclip-0.8.0-1.x86_64.rpm
```

</details>

<details>
<summary><b>AppImage (Any Distro)</b></summary>

```bash
chmod +x penguinclip_0.8.0_amd64.AppImage
./penguinclip_0.8.0_amd64.AppImage
```

</details>

### Paste Permissions (Optional)

PenguinClip needs `/dev/uinput` access to auto-paste. Without it, items are copied to clipboard but won't auto-paste into apps.

```bash
# Grant uinput access for auto-paste
sudo setfacl -m u:$USER:rw /dev/uinput
```

The app's Setup Wizard can also configure this for you on first run.

### Install Script

```bash
# Download, review, then run
curl -fsSLO https://raw.githubusercontent.com/techbysakh963/PenguinClip/main/scripts/install.sh
less install.sh
bash install.sh
```

> The installer **refuses** to run when piped from `curl`. This is intentional.

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

**Requirements:** Rust 1.77+, Node.js 20+

</details>

---

## Usage

| Hotkey | Action |
| :--- | :--- |
| **`Super+V`** | Open Clipboard History |
| **`Super+.`** | Open Emoji Picker |
| **`Ctrl+Alt+V`** | Alternative shortcut |
| **`Esc`** | Close Window |
| **`Up / Down / Tab`** | Navigate Items |
| **`Enter`** | Paste Selected Item |

### Tabs

- **Clipboard** — Full history with pin, star, delete, and smart actions
- **Favorites** — Starred items for quick access
- **GIFs** — Search and paste GIFs (opt-in, requires Tenor API key)
- **Emoji** — Searchable emoji keyboard
- **Kaomoji** — Japanese emoticons
- **Symbols** — Special characters and symbols

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

```bash
git clone https://github.com/techbysakh963/PenguinClip.git
cd PenguinClip
make deps
make dev
```

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

MIT License — See [LICENSE](LICENSE)

Original work: Copyright (c) 2024 Windows 11 Clipboard History For Linux Contributors
Fork modifications: Copyright (c) 2025-2026 PenguinClip Contributors (Developed by SAKH)
