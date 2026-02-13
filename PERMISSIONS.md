# PenguinClip - Permissions Documentation

This document explains every system permission PenguinClip requires and why.

## Required Permissions

### /dev/uinput Access (Optional but Recommended)

**What:** Read/write access to the Linux uinput device
**Why:** To simulate Ctrl+V keypress for auto-paste functionality
**Without it:** You can still copy items to clipboard, but auto-paste won't work

**How it's set up:**

1. **udev rule** (`/etc/udev/rules.d/99-penguinclip-input.rules`):
   ```
   ACTION=="add", SUBSYSTEM=="misc", KERNEL=="uinput", OPTIONS+="static_node=uinput"
   KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", TAG+="uaccess"
   ```
   This grants logged-in users (via systemd's `uaccess` tag) access to `/dev/uinput`.

2. **Kernel module** (`/etc/modules-load.d/penguinclip.conf`):
   ```
   uinput
   ```
   Ensures the `uinput` module is loaded on boot.

3. **Immediate ACL** (temporary, resets on reboot):
   ```bash
   sudo setfacl -m u:$USER:rw /dev/uinput
   ```

**Security implications:**
- Any process running as a logged-in user can create virtual input devices
- This is a standard mechanism used by many Linux input tools
- The `uaccess` tag scopes access to the physically logged-in user's session

### Temporary setup (no permanent changes):
```bash
sudo setfacl -m u:$USER:rw /dev/uinput
```
This only lasts until reboot.

### Permanent setup:
```bash
# Create udev rule
sudo tee /etc/udev/rules.d/99-penguinclip-input.rules > /dev/null << 'EOF'
ACTION=="add", SUBSYSTEM=="misc", KERNEL=="uinput", OPTIONS+="static_node=uinput"
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", TAG+="uaccess"
EOF

# Configure module to load on boot
echo "uinput" | sudo tee /etc/modules-load.d/penguinclip.conf > /dev/null

# Load module and apply rules
sudo modprobe uinput
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=misc

# Apply ACL for immediate access
sudo setfacl -m u:$USER:rw /dev/uinput
```

### Removing permissions:
```bash
sudo rm -f /etc/udev/rules.d/99-penguinclip-input.rules
sudo rm -f /etc/modules-load.d/penguinclip.conf
sudo udevadm control --reload-rules
```

## File Locations

| Path | Purpose |
|---|---|
| `~/.config/penguinclip/` | User settings, setup state |
| `~/.local/share/penguinclip/` | Clipboard history (JSON) |
| `~/.cache/penguinclip/gifs/` | Downloaded GIF cache |
| `~/.config/autostart/penguinclip.desktop` | Autostart entry (optional) |
| `/etc/udev/rules.d/99-penguinclip-input.rules` | udev rule (package install) |
| `/etc/modules-load.d/penguinclip.conf` | Module load config (package install) |

## Network Access

PenguinClip makes **no network calls by default**.

The only optional network feature is GIF integration (Tenor API), which:
- Is disabled by default
- Requires the user to provide their own API key
- Sends search queries to `https://g.tenor.com/v1/`
- Downloads GIF files from `https://media.tenor.com` and `https://media1.tenor.com`

No telemetry, analytics, or tracking of any kind.
