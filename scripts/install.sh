#!/bin/bash
# PenguinClip - Transparent Installer
# Hardened fork of Windows-11-Clipboard-History-For-Linux
#
# SECURITY: This installer is designed for security-conscious users and enterprise environments.
# It does NOT:
#   - Pipe remote scripts to bash/sudo
#   - Silently add package repositories
#   - Silently modify system permissions
#   - Execute unverified remote code
#
# Every privileged action is explained and requires explicit confirmation.
#
# Usage:
#   1. Download:  curl -fsSLO <url>/scripts/install.sh
#   2. Review:    less install.sh
#   3. Verify:    sha256sum install.sh  (compare with published checksum)
#   4. Run:       bash install.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[*]${NC} $1"; }
success() { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[-]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}=== $1 ===${NC}\n"; }

# ============================================================================
# SECURITY: Refuse to run when piped from network
# ============================================================================
if [ ! -t 0 ]; then
    echo "============================================================"
    echo "  ERROR: Non-interactive execution detected."
    echo "============================================================"
    echo ""
    echo "  This installer REFUSES to run when piped from curl/wget."
    echo "  This is a security measure to prevent blind code execution."
    echo ""
    echo "  Safe installation steps:"
    echo "    1. Download:  curl -fsSLO <url>/scripts/install.sh"
    echo "    2. Review:    less install.sh"
    echo "    3. Verify:    sha256sum install.sh"
    echo "    4. Run:       bash install.sh"
    echo ""
    echo "============================================================"
    exit 1
fi

# ============================================================================
# Configuration
# ============================================================================
APP_NAME="penguinclip"
APP_DISPLAY_NAME="PenguinClip"
REPO_OWNER="techbysakh963"
REPO_NAME="PenguinClip"

# ============================================================================
# Helpers
# ============================================================================
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local yn

    if [ "$default" = "y" ]; then
        read -r -p "$(echo -e "${YELLOW}[?]${NC} ${prompt} [Y/n]: ")" yn
        yn="${yn:-y}"
    else
        read -r -p "$(echo -e "${YELLOW}[?]${NC} ${prompt} [y/N]: ")" yn
        yn="${yn:-n}"
    fi

    case "$yn" in
        [Yy]*) return 0 ;;
        *) return 1 ;;
    esac
}

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="${ID}"
        DISTRO_ID_LIKE="${ID_LIKE:-}"
        SYSTEM_FAMILY_INFO=$(echo "$ID $ID_LIKE" | tr '[:upper:]' '[:lower:]')
    else
        error "Cannot detect distribution. /etc/os-release not found."
    fi
}

detect_arch() {
    local arch
    arch=$(uname -m)

    case "$arch" in
        x86_64|amd64)
            DEB_ARCH="amd64"
            RPM_ARCH="x86_64"
            ;;
        aarch64|arm64)
            DEB_ARCH="arm64"
            RPM_ARCH="aarch64"
            ;;
        *)
            warn "Unknown architecture: $arch. Only x86_64 and arm64 are supported."
            DEB_ARCH="amd64"
            RPM_ARCH="x86_64"
            ;;
    esac

    log "Architecture: $arch (DEB: $DEB_ARCH, RPM: $RPM_ARCH)"
}

check_webkit_compatibility() {
    log "Checking WebKitGTK compatibility..."

    if ldconfig -p 2>/dev/null | grep -q "libwebkit2gtk-4.1"; then
        success "WebKitGTK 4.1 found"
        return 0
    elif ldconfig -p 2>/dev/null | grep -q "libwebkit2gtk-4.0"; then
        warn "WebKitGTK 4.0 found (legacy). AppImage may be required."
        return 1
    else
        warn "WebKitGTK not found. It will be installed with the package."
        return 0
    fi
}

# ============================================================================
# Download and verify release packages
# ============================================================================
download_release() {
    local filename="$1"

    LATEST_RELEASE_URL="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"

    log "Fetching latest release info from GitHub..."
    RELEASE_JSON=$(curl -s "$LATEST_RELEASE_URL")
    RELEASE_TAG=$(echo "$RELEASE_JSON" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/' | tr -cd '[:alnum:]._-')

    if [ -z "$RELEASE_TAG" ]; then
        error "Failed to fetch latest release from GitHub. Check your network connection."
    fi

    CLEAN_VERSION="${RELEASE_TAG#v}"
    log "Latest version: $CLEAN_VERSION"

    # Re-evaluate filename with version
    filename=$(echo "$filename" | sed "s/VERSION/$CLEAN_VERSION/g")

    TEMP_DIR=$(mktemp -d)
    chmod 755 "$TEMP_DIR"
    trap 'rm -rf "$TEMP_DIR"' EXIT

    DOWNLOAD_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$RELEASE_TAG/$filename"

    echo ""
    log "File: $filename"
    log "URL:  $DOWNLOAD_URL"
    echo ""

    if ! confirm "Download this file?"; then
        error "Download cancelled by user."
    fi

    curl -L -o "$TEMP_DIR/$filename" "$DOWNLOAD_URL" --progress-bar
    chmod 644 "$TEMP_DIR/$filename"

    # Display checksum for verification
    local checksum
    checksum=$(sha256sum "$TEMP_DIR/$filename" | cut -d' ' -f1)
    echo ""
    success "Downloaded: $filename"
    log "SHA256: $checksum"
    log "Compare this checksum with the one published on the release page."
    echo ""

    DOWNLOADED_FILE="$TEMP_DIR/$filename"
}

# ============================================================================
# Distribution-specific installers
# ============================================================================

install_deb() {
    header "Debian/Ubuntu Installation"

    log "This will:"
    echo "  1. Download the .deb package from GitHub Releases"
    echo "  2. Install runtime dependencies (xclip, wl-clipboard, acl)"
    echo "  3. Install the .deb package via apt"
    echo ""
    echo "  NOTE: This does NOT add any third-party package repository."
    echo "  The package is installed directly from the downloaded .deb file."
    echo ""

    download_release "${APP_NAME}_VERSION_${DEB_ARCH}.deb"

    header "Installing Dependencies"
    log "Required packages:"
    echo "  - xclip:                       X11 clipboard access"
    echo "  - wl-clipboard:                Wayland clipboard access"
    echo "  - acl:                         Access control list tools"
    echo "  - libayatana-appindicator3-1:  System tray support"
    echo ""

    if confirm "Install these dependencies via apt? (requires sudo)" "y"; then
        sudo apt-get update -qq
        sudo apt-get install -y xclip wl-clipboard acl || true
        sudo apt-get install -y libayatana-appindicator3-1 || sudo apt-get install -y libappindicator3-1 || true
        success "Dependencies installed."
    else
        warn "Skipping dependency installation."
    fi

    header "Installing Package"
    log "File: $DOWNLOADED_FILE"

    if confirm "Install the .deb package? (requires sudo)" "y"; then
        sudo apt-get install -y "$DOWNLOADED_FILE"
        success "Package installed."
    else
        warn "Package NOT installed. File saved at: $DOWNLOADED_FILE"
        trap - EXIT  # Keep temp dir
    fi
}

install_rpm_fedora() {
    header "Fedora/RHEL Installation"

    log "This will:"
    echo "  1. Download the .rpm package from GitHub Releases"
    echo "  2. Install runtime dependencies"
    echo "  3. Install the .rpm package via dnf"
    echo ""
    echo "  NOTE: This does NOT add any third-party package repository."
    echo ""

    download_release "${APP_NAME}-VERSION-1.${RPM_ARCH}.rpm"

    if confirm "Install dependencies (xclip, wl-clipboard, acl) via dnf? (requires sudo)" "y"; then
        sudo dnf install -y xclip wl-clipboard acl libayatana-appindicator-gtk3 || true
        success "Dependencies installed."
    fi

    if confirm "Install the .rpm package? (requires sudo)" "y"; then
        sudo dnf install -y "$DOWNLOADED_FILE"
        success "Package installed."
    else
        warn "Package NOT installed. File saved at: $DOWNLOADED_FILE"
        trap - EXIT
    fi
}

install_rpm_suse() {
    header "OpenSUSE Installation"

    download_release "${APP_NAME}-VERSION-1.${RPM_ARCH}.rpm"

    if confirm "Install dependencies via zypper? (requires sudo)" "y"; then
        sudo zypper install -y xclip wl-clipboard acl libayatana-appindicator3-1 || true
    fi

    if confirm "Install the .rpm package? (requires sudo)" "y"; then
        sudo zypper install -y "$DOWNLOADED_FILE"
        success "Package installed."
    else
        warn "Package NOT installed. File saved at: $DOWNLOADED_FILE"
        trap - EXIT
    fi
}

install_arch() {
    header "Arch Linux Installation"

    log "For Arch Linux, we recommend the AUR package."
    echo ""

    if command -v yay &>/dev/null; then
        log "Found AUR helper: yay"
        if confirm "Install ${APP_NAME}-bin from AUR via yay?"; then
            yay -S "${APP_NAME}-bin"
            return 0
        fi
    elif command -v paru &>/dev/null; then
        log "Found AUR helper: paru"
        if confirm "Install ${APP_NAME}-bin from AUR via paru?"; then
            paru -S "${APP_NAME}-bin"
            return 0
        fi
    else
        warn "No AUR helper found."
        echo ""
        echo "To install an AUR helper yourself:"
        echo "  sudo pacman -S --needed git base-devel"
        echo "  git clone https://aur.archlinux.org/yay-bin.git"
        echo "  cd yay-bin && makepkg -si"
        echo ""
        echo "Then re-run this installer, or run:"
        echo "  yay -S ${APP_NAME}-bin"
        echo ""
    fi

    if confirm "Install the AppImage version instead?"; then
        install_appimage
    fi
}

install_appimage() {
    header "AppImage Installation"

    log "This will:"
    echo "  1. Download the AppImage from GitHub Releases"
    echo "  2. Place it in ~/.local/bin/"
    echo "  3. Create a .desktop entry in ~/.local/share/applications/"
    echo ""
    echo "  No root access required for this method."
    echo ""

    LATEST_URL=$(curl -s "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest" \
        | grep "browser_download_url.*AppImage" \
        | cut -d '"' -f 4)

    if [ -z "$LATEST_URL" ]; then
        error "Could not find AppImage download URL."
    fi

    log "URL: $LATEST_URL"

    if ! confirm "Download AppImage?"; then
        error "Installation cancelled."
    fi

    mkdir -p "$HOME/.local/bin"
    mkdir -p "$HOME/.local/share/applications"

    log "Downloading..."
    curl -fsSL -o "$HOME/.local/bin/${APP_NAME}.AppImage" "$LATEST_URL"
    chmod +x "$HOME/.local/bin/${APP_NAME}.AppImage"

    local checksum
    checksum=$(sha256sum "$HOME/.local/bin/${APP_NAME}.AppImage" | cut -d' ' -f1)
    log "SHA256: $checksum"

    # Wrapper script
    cat > "$HOME/.local/bin/${APP_NAME}" << 'WRAPPER_EOF'
#!/bin/bash
# PenguinClip AppImage wrapper
unset LD_LIBRARY_PATH LD_PRELOAD GTK_PATH GIO_MODULE_DIR
export GDK_SCALE="${GDK_SCALE:-1}"
export GDK_DPI_SCALE="${GDK_DPI_SCALE:-1}"
export NO_AT_BRIDGE=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/penguinclip.AppImage" "$@"
WRAPPER_EOF
    chmod +x "$HOME/.local/bin/${APP_NAME}"

    # Desktop entry
    cat > "$HOME/.local/share/applications/${APP_NAME}.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=${APP_DISPLAY_NAME}
Comment=Secure Clipboard History Manager for Linux
Exec=$HOME/.local/bin/${APP_NAME}
Icon=${APP_NAME}
Terminal=false
Categories=Utility;
StartupWMClass=${APP_NAME}
DESKTOP_EOF

    if command -v update-desktop-database &>/dev/null; then
        update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    fi

    success "AppImage installed to ~/.local/bin/"

    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        warn "~/.local/bin is not in your PATH."
        echo "  Add to your shell config:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
}

# ============================================================================
# Permission setup (fully transparent and opt-in)
# ============================================================================
setup_uinput_permissions() {
    header "Input Device Permissions (Optional)"

    echo "${APP_DISPLAY_NAME} needs access to /dev/uinput to simulate keyboard"
    echo "input (Ctrl+V paste) after selecting a clipboard item."
    echo ""
    echo "Without this, you can still copy items to clipboard, but"
    echo "auto-paste into the active window will not work."
    echo ""
    echo "${BOLD}What will be modified:${NC}"
    echo "  1. /etc/udev/rules.d/99-${APP_NAME}-input.rules  (new file)"
    echo "     Grants logged-in users access to /dev/uinput"
    echo ""
    echo "  2. /etc/modules-load.d/${APP_NAME}.conf  (new file)"
    echo "     Loads the 'uinput' kernel module on boot"
    echo ""
    echo "  3. ACL on /dev/uinput  (immediate, temporary)"
    echo "     Grants your user read/write access right now"
    echo ""
    echo "${BOLD}Security implications:${NC}"
    echo "  The uinput device allows creating virtual input devices."
    echo "  Any process running as a logged-in user will have this access."
    echo "  This is a standard requirement for input simulation tools."
    echo ""

    if ! confirm "Set up uinput permissions?"; then
        log "Skipping uinput setup. You can do this later manually."
        echo ""
        echo "  Temporary (until reboot):"
        echo "    sudo setfacl -m u:\$USER:rw /dev/uinput"
        echo ""
        echo "  Permanent:"
        echo "    See PERMISSIONS.md in the repository."
        return 0
    fi

    # Step 1: udev rule
    echo ""
    log "Step 1/3: Creating udev rule"
    echo "  File: /etc/udev/rules.d/99-${APP_NAME}-input.rules"
    echo "  Contents:"
    echo "    ACTION==\"add\", SUBSYSTEM==\"misc\", KERNEL==\"uinput\", OPTIONS+=\"static_node=uinput\""
    echo "    KERNEL==\"uinput\", SUBSYSTEM==\"misc\", MODE=\"0660\", GROUP=\"input\", TAG+=\"uaccess\""
    echo ""

    if confirm "Create this udev rule? (requires sudo)"; then
        sudo tee "/etc/udev/rules.d/99-${APP_NAME}-input.rules" > /dev/null << 'UDEV_EOF'
# PenguinClip - udev rules for uinput access
# Allows logged-in users to create virtual input devices for paste simulation
ACTION=="add", SUBSYSTEM=="misc", KERNEL=="uinput", OPTIONS+="static_node=uinput"
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", TAG+="uaccess"
UDEV_EOF
        success "Udev rule created."
    else
        warn "Skipped udev rule."
    fi

    # Step 2: module load config
    echo ""
    log "Step 2/3: Configuring kernel module auto-load"
    echo "  File: /etc/modules-load.d/${APP_NAME}.conf"
    echo "  Contents: uinput"
    echo ""

    if confirm "Create module load config? (requires sudo)"; then
        echo "uinput" | sudo tee "/etc/modules-load.d/${APP_NAME}.conf" > /dev/null
        sudo modprobe uinput 2>/dev/null || true
        sudo udevadm control --reload-rules 2>/dev/null || true
        sudo udevadm trigger --subsystem-match=misc 2>/dev/null || true
        success "Module configured and loaded."
    else
        warn "Skipped module configuration."
    fi

    # Step 3: immediate ACL
    echo ""
    log "Step 3/3: Granting immediate access via ACL"
    echo "  Command: sudo setfacl -m u:${USER}:rw /dev/uinput"
    echo "  This is temporary and resets on reboot (the udev rule makes it permanent)."
    echo ""

    if confirm "Apply ACL now? (requires sudo)"; then
        if command -v setfacl &>/dev/null && [ -e /dev/uinput ]; then
            sudo setfacl -m "u:${USER}:rw" /dev/uinput 2>/dev/null || true
            success "ACL applied. Paste should work immediately."
        else
            warn "setfacl not available or /dev/uinput not found."
        fi
    fi
}

# ============================================================================
# Main
# ============================================================================
main() {
    echo ""
    echo "================================================================"
    echo "  ${APP_DISPLAY_NAME} - Secure Clipboard Manager for Linux"
    echo "  Hardened fork of Windows-11-Clipboard-History-For-Linux"
    echo "================================================================"
    echo ""
    echo "This installer guides you through each step."
    echo "Every privileged action requires your explicit confirmation."
    echo ""

    command -v curl >/dev/null 2>&1 || error "curl is required."

    detect_distro
    detect_arch
    log "Detected: $DISTRO_ID (Family: $SYSTEM_FAMILY_INFO)"

    check_webkit_compatibility
    webkit_status=$?

    # Select installation method
    if [ "$webkit_status" -eq 1 ]; then
        warn "Legacy WebKitGTK detected. AppImage recommended."
        if confirm "Use AppImage installation?" "y"; then
            install_appimage
        fi
    elif [[ "$SYSTEM_FAMILY_INFO" =~ "arch" ]] || command -v pacman &>/dev/null; then
        install_arch
    elif [[ "$SYSTEM_FAMILY_INFO" =~ "debian" || "$SYSTEM_FAMILY_INFO" =~ "ubuntu" ]] || command -v apt-get &>/dev/null; then
        install_deb
    elif [[ "$SYSTEM_FAMILY_INFO" =~ "fedora" || "$SYSTEM_FAMILY_INFO" =~ "rhel" || "$SYSTEM_FAMILY_INFO" =~ "centos" ]] || command -v dnf &>/dev/null; then
        install_rpm_fedora
    elif [[ "$SYSTEM_FAMILY_INFO" =~ "suse" ]] || command -v zypper &>/dev/null; then
        install_rpm_suse
    else
        warn "Unrecognized distribution."
        if confirm "Try AppImage installation?" "y"; then
            install_appimage
        else
            error "No installation method available."
        fi
    fi

    # Optional: uinput permission setup
    setup_uinput_permissions

    # Optional: launch
    header "Installation Complete"

    if confirm "Launch ${APP_DISPLAY_NAME} now?"; then
        nohup "${APP_NAME}" >/dev/null 2>&1 < /dev/null & disown
        sleep 2
        if pgrep -f "${APP_NAME}" > /dev/null; then
            success "App is running. Press Super+V to open clipboard history."
        else
            warn "App may not have started. Try launching from your application menu."
        fi
    fi

    echo ""
    success "================================================================"
    success "  ${APP_DISPLAY_NAME} installed successfully!"
    success "  Press Super+V to open your clipboard history."
    success "================================================================"
    echo ""
}

main "$@"
