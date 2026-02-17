#!/bin/bash
# Wrapper for PenguinClip
# Purpose: Clean environment to avoid Snap/Flatpak library conflicts
#          and force X11/XWayland for window positioning on Wayland

set -e

BINARY_LOCATIONS=(
    "/usr/bin/penguinclip-bin"
    "/usr/lib/penguinclip/penguinclip-bin"
    "/usr/local/lib/penguinclip/penguinclip-bin"
)

# Find the binary
BINARY=""
for loc in "${BINARY_LOCATIONS[@]}"; do
    if [ -x "$loc" ]; then
        BINARY="$loc"
        break
    fi
done

# Verify binary was found
if [ -z "$BINARY" ]; then
    echo "Error: penguinclip binary not found." >&2
    echo "The wrapper searched for an executable in the following locations (in order):" >&2
    for loc in "${BINARY_LOCATIONS[@]}"; do
        echo "  - $loc" >&2
    done
    echo "" >&2
    echo "If you installed via package manager, try reinstalling the package." >&2
    echo "If you installed manually with a custom PREFIX, ensure the binary is in one of the locations above." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Runtime environment sanitization
# ---------------------------------------------------------------------------
# When launched from a Snap terminal (e.g. VS Code Snap) or a Flatpak host,
# the parent process may inject library/schema paths from its confined runtime
# into child processes. These paths point to sandbox-internal libraries that
# are incompatible with the host GTK/WebKit stack this app links against,
# causing crashes, missing schemas, or wrong icon themes.
# ---------------------------------------------------------------------------

# Always clear library/runtime overrides
unset LD_LIBRARY_PATH
unset LD_PRELOAD
unset GTK_PATH
unset GIO_MODULE_DIR
unset GTK_IM_MODULE_FILE
unset GTK_EXE_PREFIX
unset LOCPATH
unset GSETTINGS_SCHEMA_DIR

# Fix XDG_DATA_DIRS only when contaminated by sandbox paths.
sanitize_xdg_data_dirs() {
    local xdg="${XDG_DATA_DIRS:-}"
    local system_dirs="/usr/local/share:/usr/share:/var/lib/snapd/desktop"

    if [[ -z "${SNAP:-}" && -z "${FLATPAK_ID:-}" && "$xdg" != *"/snap/"* && "$xdg" != *"/flatpak/"* ]]; then
        return
    fi

    local cleaned=""
    local entry
    IFS=':' read -ra entries <<< "$xdg"
    for entry in "${entries[@]}"; do
        case "$entry" in
            */snap/*|*/flatpak/*) continue ;;
        esac
        case ":$system_dirs:" in
            *":$entry:"*) continue ;;
        esac
        cleaned="${cleaned:+$cleaned:}$entry"
    done

    export XDG_DATA_DIRS="${system_dirs}${cleaned:+:$cleaned}"
}
sanitize_xdg_data_dirs

# ---------------------------------------------------------------------------
# NVIDIA GPU detection
# ---------------------------------------------------------------------------
detect_nvidia() {
    if [[ -n "${IS_NVIDIA:-}" ]]; then
        return 0
    fi

    if lsmod 2>/dev/null | grep -qi '^nvidia'; then
        export IS_NVIDIA=1
        return 0
    fi

    if command -v lspci &>/dev/null && lspci 2>/dev/null | grep -qi 'vga.*nvidia'; then
        export IS_NVIDIA=1
        return 0
    fi

    return 1
}
detect_nvidia || true

# ---------------------------------------------------------------------------
# AppImage detection
# ---------------------------------------------------------------------------
if [[ -n "${APPIMAGE:-}" ]]; then
    export IS_APPIMAGE=1
fi

# ---------------------------------------------------------------------------
# WebKit DMA-BUF workaround for NVIDIA / AppImage
# ---------------------------------------------------------------------------
if [[ "${IS_NVIDIA:-}" == "1" || "${IS_APPIMAGE:-}" == "1" ]]; then
    echo "Info: Disabling WebKit DMA-BUF renderer due to NVIDIA GPU or AppImage environment."
    export WEBKIT_DISABLE_DMABUF_RENDERER=1
fi

# ---------------------------------------------------------------------------
# Display & rendering defaults
# ---------------------------------------------------------------------------
export GDK_SCALE="${GDK_SCALE:-1}"
export GDK_DPI_SCALE="${GDK_DPI_SCALE:-1}"

export TAURI_TRAY="${TAURI_TRAY:-libayatana-appindicator3}"

# Disable AT-SPI to prevent accessibility bus warnings/delays
export NO_AT_BRIDGE=1

# Force software rendering in virtualized environments to avoid GPU issues
if systemd-detect-virt -q 2>/dev/null; then
    export LIBGL_ALWAYS_SOFTWARE=1
fi

exec "$BINARY" "$@"
