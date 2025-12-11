#!/bin/bash

set -e

# Configuration
REPO_OWNER="gustavosett"
REPO_NAME="Windows-11-Clipboard-History-For-Linux"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check for curl
command -v curl >/dev/null 2>&1 || error "curl is required but not installed."

# Get latest release tag
log "Fetching latest release version..."
LATEST_RELEASE_URL="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
RELEASE_TAG=$(curl -s "$LATEST_RELEASE_URL" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/' | tr -cd '[:alnum:]._-')

if [ -z "$RELEASE_TAG" ]; then
    error "Failed to fetch latest version. Please check your internet connection."
fi

CLEAN_VERSION="${RELEASE_TAG#v}"
log "Latest version: $RELEASE_TAG"

# Detect Architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    error "Unsupported architecture: $ARCH. Only x86_64 is supported."
fi

# Detect Distro
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
else
    DISTRO="unknown"
fi

# Prepare download
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
trap 'rm -rf "$TEMP_DIR"' EXIT

download_and_install() {
    local url="$1"
    local filename="$2"
    local install_cmd="$3"

    log "Downloading $filename..."
    log "URL: $url"
    curl -L -o "$filename" "$url"
    
    if [ ! -f "$filename" ]; then
        error "Download failed."
    fi

    log "Installing..."
    eval "$install_cmd"
}

BASE_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$RELEASE_TAG"

case "$DISTRO" in
    ubuntu|debian|linuxmint|pop|kali|neon)
        FILE="win11-clipboard-history_${CLEAN_VERSION}_amd64.deb"
        URL="$BASE_URL/$FILE"
        CMD="sudo dpkg -i $FILE || sudo apt-get install -f -y"
        download_and_install "$URL" "$FILE" "$CMD"
        ;;
    fedora|rhel|centos|almalinux|rocky)
        FILE="win11-clipboard-history-${CLEAN_VERSION}-1.x86_64.rpm"
        URL="$BASE_URL/$FILE"
        CMD="sudo rpm -i $FILE || sudo dnf install -y ./$FILE"
        download_and_install "$URL" "$FILE" "$CMD"
        ;;
    *)
        log "Distribution '$DISTRO' not officially supported for native package. Installing AppImage..."
        FILE="win11-clipboard-history_${CLEAN_VERSION}_amd64.AppImage"
        URL="$BASE_URL/$FILE"
        
        log "Downloading $FILE..."
        curl -L -o "$FILE" "$URL"
        chmod +x "$FILE"
        
        INSTALL_DIR="$HOME/.local/bin"
        mkdir -p "$INSTALL_DIR"
        mv "$FILE" "$INSTALL_DIR/win11-clipboard-history"
        
        success "AppImage installed to $INSTALL_DIR/win11-clipboard-history"
        echo "Please ensure $INSTALL_DIR is in your PATH."
        exit 0
        ;;
esac

success "Installation completed successfully!"
