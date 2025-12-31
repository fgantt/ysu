#!/bin/bash

# Script to copy all UI-related files to a new location
# This preserves the original repository intact
#
# Usage: ./scripts/copy-ui-files.sh <destination_path>
#
# Example: ./scripts/copy-ui-files.sh ../shogi-ui

set -e

if [ -z "$1" ]; then
    echo "Error: Destination path is required"
    echo "Usage: $0 <destination_path>"
    exit 1
fi

DEST="$1"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

echo "Copying UI files from: $SOURCE"
echo "To: $DEST"
echo ""

# Create destination directory if it doesn't exist
mkdir -p "$DEST"

# Function to copy directory structure
copy_dir() {
    local src="$1"
    local dest="$2"
    if [ -d "$src" ]; then
        echo "Copying $src -> $dest"
        mkdir -p "$dest"
        cp -r "$src"/* "$dest"/ 2>/dev/null || true
    fi
}

# Function to copy file
copy_file() {
    local src="$1"
    local dest="$2"
    if [ -f "$src" ]; then
        echo "Copying $src -> $dest"
        mkdir -p "$(dirname "$dest")"
        cp "$src" "$dest"
    fi
}

# Copy root-level UI files
echo "=== Copying root-level UI files ==="
copy_file "$SOURCE/package.json" "$DEST/package.json"
copy_file "$SOURCE/package-lock.json" "$DEST/package-lock.json" 2>/dev/null || true
copy_file "$SOURCE/yarn.lock" "$DEST/yarn.lock" 2>/dev/null || true
copy_file "$SOURCE/vite.config.ts" "$DEST/vite.config.ts"
copy_file "$SOURCE/tsconfig.json" "$DEST/tsconfig.json"
copy_file "$SOURCE/eslint.config.js" "$DEST/eslint.config.js"
copy_file "$SOURCE/index.html" "$DEST/index.html"
copy_file "$SOURCE/vitest.setup.ts" "$DEST/vitest.setup.ts" 2>/dev/null || true

# Copy Tauri configuration
echo ""
echo "=== Copying Tauri configuration ==="
copy_dir "$SOURCE/src-tauri" "$DEST/src-tauri"

# Copy UI source directories
echo ""
echo "=== Copying UI source code ==="
copy_dir "$SOURCE/src/components" "$DEST/src/components"
copy_dir "$SOURCE/src/context" "$DEST/src/context"
copy_dir "$SOURCE/src/hooks" "$DEST/src/hooks"
copy_dir "$SOURCE/src/usi" "$DEST/src/usi"
copy_dir "$SOURCE/src/styles" "$DEST/src/styles"
copy_dir "$SOURCE/src/assets" "$DEST/src/assets"

# Copy UI source files
echo ""
echo "=== Copying UI source files ==="
copy_file "$SOURCE/src/App.tsx" "$DEST/src/App.tsx"
copy_file "$SOURCE/src/App.css" "$DEST/src/App.css"
copy_file "$SOURCE/src/main.tsx" "$DEST/src/main.tsx"
copy_file "$SOURCE/src/index.css" "$DEST/src/index.css"
copy_file "$SOURCE/src/types.ts" "$DEST/src/types.ts"
copy_file "$SOURCE/src/vite-env.d.ts" "$DEST/src/vite-env.d.ts"

# Copy UI types (TypeScript files only)
echo ""
echo "=== Copying UI types (TypeScript files) ==="
mkdir -p "$DEST/src/types"
if [ -f "$SOURCE/src/types/engine.ts" ]; then
    copy_file "$SOURCE/src/types/engine.ts" "$DEST/src/types/engine.ts"
fi

# Copy UI utils (TypeScript files only)
echo ""
echo "=== Copying UI utils (TypeScript files) ==="
mkdir -p "$DEST/src/utils"
# Copy all TypeScript files from utils
if [ -d "$SOURCE/src/utils" ]; then
    find "$SOURCE/src/utils" -name "*.ts" -type f | while read -r file; do
        rel_path="${file#$SOURCE/src/utils/}"
        copy_file "$file" "$DEST/src/utils/$rel_path"
    done
    # Also copy test files
    find "$SOURCE/src/utils" -name "*.test.ts" -type f | while read -r file; do
        rel_path="${file#$SOURCE/src/utils/}"
        copy_file "$file" "$DEST/src/utils/$rel_path"
    done
fi

# Copy public assets
echo ""
echo "=== Copying public assets ==="
copy_dir "$SOURCE/public" "$DEST/public"

# Copy dist (if it exists)
if [ -d "$SOURCE/dist" ]; then
    echo "Copying dist directory"
    copy_dir "$SOURCE/dist" "$DEST/dist"
fi

# Copy UI-specific documentation
echo ""
echo "=== Copying UI documentation ==="
mkdir -p "$DEST/docs"

# User docs
if [ -d "$SOURCE/docs/user" ]; then
    copy_dir "$SOURCE/docs/user" "$DEST/docs/user"
fi

# Development docs (UI-related)
if [ -d "$SOURCE/docs/development" ]; then
    copy_dir "$SOURCE/docs/development" "$DEST/docs/development"
fi

# Design docs (UI-related)
if [ -d "$SOURCE/docs/design" ]; then
    copy_dir "$SOURCE/docs/design" "$DEST/docs/design"
    # Remove engine-specific implementation docs if they were copied
    if [ -d "$DEST/docs/design/implementation" ]; then
        echo "Note: Removing engine-specific implementation docs from UI repo"
        rm -rf "$DEST/docs/design/implementation"
    fi
fi

# Architecture docs (keep in UI as they may reference both)
if [ -d "$SOURCE/docs/architecture" ]; then
    copy_dir "$SOURCE/docs/architecture" "$DEST/docs/architecture"
fi

# Distribution docs
if [ -d "$SOURCE/docs/distribution" ]; then
    copy_dir "$SOURCE/docs/distribution" "$DEST/docs/distribution"
fi

# Implementation docs (UI-related)
if [ -d "$SOURCE/docs/implementation" ]; then
    copy_dir "$SOURCE/docs/implementation" "$DEST/docs/implementation"
fi

# Monitoring docs
if [ -d "$SOURCE/docs/monitoring" ]; then
    copy_dir "$SOURCE/docs/monitoring" "$DEST/docs/monitoring"
fi

# Release docs
if [ -d "$SOURCE/docs/release" ]; then
    copy_dir "$SOURCE/docs/release" "$DEST/docs/release"
fi

# Archive docs
if [ -d "$SOURCE/docs/archive" ]; then
    copy_dir "$SOURCE/docs/archive" "$DEST/docs/archive"
fi

# Cleanup docs
if [ -d "$SOURCE/docs/cleanup" ]; then
    copy_dir "$SOURCE/docs/cleanup" "$DEST/docs/cleanup"
fi

# Copy scripts (UI-related)
echo ""
echo "=== Copying UI-related scripts ==="
mkdir -p "$DEST/scripts"
# Copy all scripts (they may be used by UI build process)
if [ -d "$SOURCE/scripts" ]; then
    copy_dir "$SOURCE/scripts" "$DEST/scripts"
fi

# Copy build configuration files
echo ""
echo "=== Copying build configuration ==="
copy_file "$SOURCE/build.sh" "$DEST/build.sh" 2>/dev/null || true
copy_file "$SOURCE/.gitignore" "$DEST/.gitignore" 2>/dev/null || true
copy_file "$SOURCE/.gitattributes" "$DEST/.gitattributes" 2>/dev/null || true

# Copy app icon and other root assets
echo ""
echo "=== Copying root assets ==="
copy_file "$SOURCE/app-icon.png" "$DEST/app-icon.png" 2>/dev/null || true
copy_file "$SOURCE/board.png" "$DEST/board.png" 2>/dev/null || true

# Create a basic README for the UI repo
echo ""
echo "=== Creating UI README ==="
if [ ! -f "$DEST/README.md" ]; then
    cat > "$DEST/README.md" << 'EOF'
# Shogi UI

This is the Shogi game UI, built with React, TypeScript, and Tauri.

## Prerequisites

- Node.js and npm/yarn
- Rust (for Tauri)

## Development

```bash
npm install
npm run tauri:dev
```

## Building

```bash
npm run build
npm run tauri:build
```

## Engine

This UI requires a Shogi engine binary. See the engine repository for details.

The engine should be available as a USI-compatible binary.
EOF
    echo "Created README.md"
fi

# Create a placeholder for engine binary location
echo ""
echo "=== Creating engine integration notes ==="
mkdir -p "$DEST/docs"
cat > "$DEST/docs/ENGINE_INTEGRATION.md" << 'EOF'
# Engine Integration

This UI requires a Shogi engine binary to function.

## Engine Location

The engine binary should be:
- Available as a USI-compatible executable
- Referenced in the Tauri configuration
- Bundled with the application or downloaded on first run

## Development

For local development, you can:
1. Build the engine from the engine repository
2. Place the binary in the expected location
3. Or configure the UI to use an external engine path

See the engine repository for building instructions.
EOF
echo "Created docs/ENGINE_INTEGRATION.md"

echo ""
echo "=== UI files copied successfully ==="
echo "Destination: $DEST"
echo ""
echo "Note: This script copied files but did not initialize a git repository."
echo "To set up the UI repository:"
echo "  cd $DEST"
echo "  git init"
echo "  git add ."
echo "  git commit -m 'Initial UI repository'"
echo ""
echo "Important: You will need to:"
echo "  1. Update package.json to remove engine build scripts"
echo "  2. Update Tauri configuration for engine binary location"
echo "  3. Set up engine binary distribution mechanism"


