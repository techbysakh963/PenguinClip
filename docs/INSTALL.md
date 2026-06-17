# Installing PenguinClip

PenguinClip ships as a `.deb`, `.rpm`, and `.AppImage`. Download the latest from
the [Releases page](https://github.com/techbysakh963/PenguinClip/releases).

> Replace `1.0.0` in the commands below with the version you downloaded.

## Debian / Ubuntu / Pop!_OS / Linux Mint

```bash
sudo apt install ./penguinclip_1.0.0_amd64.deb
```

To upgrade an existing install, install the new `.deb` the same way; to remove it:

```bash
sudo apt remove penguinclip          # keep your history & settings
sudo apt purge  penguinclip          # also remove system config
```

Your clipboard history and settings live in `~/.local/share/penguinclip` and
`~/.config/penguinclip` and are **not** removed by apt. Delete those folders for a
full clean slate.

## Fedora / openSUSE / RHEL

```bash
sudo dnf install ./penguinclip-1.0.0-1.x86_64.rpm
```

## AppImage (any distribution)

```bash
chmod +x penguinclip_1.0.0_amd64.AppImage
./penguinclip_1.0.0_amd64.AppImage
```

## Paste permissions (recommended)

PenguinClip needs access to `/dev/uinput` to auto-paste into other apps. Without
it, selecting an item still copies it to the clipboard, but you paste manually.
The `.deb`/`.rpm` set this up for you; for the AppImage or to grant it manually:

```bash
sudo setfacl -m u:$USER:rw /dev/uinput
```

The first-run **Setup Wizard** can also configure this, register the `Super+V`
shortcut, and enable autostart for you.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Super+V` | Open clipboard history |
| `Super+.` | Open emoji picker |
| `Ctrl+Alt+V` | Alternative open shortcut |

If `Super+V` doesn't work, open **Settings** — it detects your desktop
environment (GNOME, KDE, COSMIC, Sway, Hyprland, …) and shows how to bind it.

## Build from source

```bash
git clone https://github.com/techbysakh963/PenguinClip.git
cd PenguinClip
make deps      # install Rust, Node, and system build dependencies
make build     # produces packages in src-tauri/target/release/bundle/
sudo make install
```

## Troubleshooting

- **Auto-paste does nothing** — grant `/dev/uinput` access (above) and, if you
  were just added to the `input` group, log out and back in.
- **Window doesn't appear / shortcut unbound** — check **Settings** for your DE's
  binding instructions.
- **Report an issue** — **Settings → Diagnostics → Export diagnostics** writes a
  shareable report (no clipboard content) to attach to your bug report. See
  [DIAGNOSTICS.md](DIAGNOSTICS.md).
