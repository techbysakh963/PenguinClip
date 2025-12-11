#!/bin/bash
# Clean environment script to avoid snap library conflicts

# Reset problematic environment variables
unset GIO_MODULE_DIR
unset GTK_PATH
unset GTK_IM_MODULE_FILE
unset GTK_EXE_PREFIX
unset LOCPATH
unset GSETTINGS_SCHEMA_DIR

# Use system XDG_DATA_DIRS
export XDG_DATA_DIRS="/usr/local/share:/usr/share:/var/lib/snapd/desktop"

# Change to project directory
cd "$(dirname "$0")/.."

# Run tauri dev
npm run tauri:dev
