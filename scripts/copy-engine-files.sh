#!/bin/bash

# Script to copy all engine-related files to a new location
# This preserves the original repository intact
#
# Usage: ./scripts/copy-engine-files.sh <destination_path>
#
# Example: ./scripts/copy-engine-files.sh ../shogi-engine

set -e

if [ -z "$1" ]; then
    echo "Error: Destination path is required"
    echo "Usage: $0 <destination_path>"
    exit 1
fi

DEST="$1"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

echo "Copying engine files from: $SOURCE"
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

# Copy root-level engine files
echo "=== Copying root-level engine files ==="
copy_file "$SOURCE/Cargo.toml" "$DEST/Cargo.toml"
copy_file "$SOURCE/Cargo.lock" "$DEST/Cargo.lock"
copy_file "$SOURCE/rustfmt.toml" "$DEST/rustfmt.toml"

# Copy engine source directories
echo ""
echo "=== Copying engine source code ==="
copy_dir "$SOURCE/src/bitboards" "$DEST/src/bitboards"
copy_dir "$SOURCE/src/search" "$DEST/src/search"
copy_dir "$SOURCE/src/evaluation" "$DEST/src/evaluation"
copy_dir "$SOURCE/src/opening_book" "$DEST/src/opening_book"
copy_dir "$SOURCE/src/tablebase" "$DEST/src/tablebase"
copy_dir "$SOURCE/src/tuning" "$DEST/src/tuning"
copy_dir "$SOURCE/src/config" "$DEST/src/config"
copy_dir "$SOURCE/src/bin" "$DEST/src/bin"

# Copy engine source files (Rust files in src root)
echo ""
echo "=== Copying engine source files ==="
copy_file "$SOURCE/src/lib.rs" "$DEST/src/lib.rs"
copy_file "$SOURCE/src/main.rs" "$DEST/src/main.rs"
copy_file "$SOURCE/src/bitboards.rs" "$DEST/src/bitboards.rs"
copy_file "$SOURCE/src/moves.rs" "$DEST/src/moves.rs"
copy_file "$SOURCE/src/evaluation.rs" "$DEST/src/evaluation.rs"
copy_file "$SOURCE/src/opening_book.rs" "$DEST/src/opening_book.rs"
copy_file "$SOURCE/src/opening_book_converter.rs" "$DEST/src/opening_book_converter.rs"
copy_file "$SOURCE/src/usi.rs" "$DEST/src/usi.rs"
copy_file "$SOURCE/src/kif_parser.rs" "$DEST/src/kif_parser.rs"
copy_file "$SOURCE/src/debug_utils.rs" "$DEST/src/debug_utils.rs"
copy_file "$SOURCE/src/error.rs" "$DEST/src/error.rs"
copy_file "$SOURCE/src/time_utils.rs" "$DEST/src/time_utils.rs"
copy_file "$SOURCE/src/weights.rs" "$DEST/src/weights.rs"

# Copy engine types (Rust files only)
echo ""
echo "=== Copying engine types (Rust files) ==="
copy_dir "$SOURCE/src/types" "$DEST/src/types"
# Remove TypeScript files from types directory
if [ -d "$DEST/src/types" ]; then
    find "$DEST/src/types" -name "*.ts" -type f -delete
fi

# Copy engine utils (Rust files only)
echo ""
echo "=== Copying engine utils (Rust files) ==="
mkdir -p "$DEST/src/utils"
copy_file "$SOURCE/src/utils/mod.rs" "$DEST/src/utils/mod.rs"
copy_file "$SOURCE/src/utils/common.rs" "$DEST/src/utils/common.rs"
copy_file "$SOURCE/src/utils/telemetry.rs" "$DEST/src/utils/telemetry.rs"
copy_file "$SOURCE/src/utils/time.rs" "$DEST/src/utils/time.rs"

# Copy engine resources
echo ""
echo "=== Copying engine resources ==="
copy_dir "$SOURCE/benches" "$DEST/benches"
copy_dir "$SOURCE/tests" "$DEST/tests"
copy_dir "$SOURCE/examples" "$DEST/examples"
copy_dir "$SOURCE/config" "$DEST/config"
copy_dir "$SOURCE/resources" "$DEST/resources"

# Copy engine-specific documentation
echo ""
echo "=== Copying engine documentation ==="
mkdir -p "$DEST/docs"

# Engine-specific docs
copy_file "$SOURCE/docs/ENGINE_UTILITIES_GUIDE.md" "$DEST/docs/ENGINE_UTILITIES_GUIDE.md"
copy_file "$SOURCE/docs/ENGINE_CONFIGURATION_GUIDE.md" "$DEST/docs/ENGINE_CONFIGURATION_GUIDE.md"
copy_file "$SOURCE/docs/UTILITIES_QUICK_REFERENCE.md" "$DEST/docs/UTILITIES_QUICK_REFERENCE.md"

# Performance docs
if [ -d "$SOURCE/docs/performance" ]; then
    copy_dir "$SOURCE/docs/performance" "$DEST/docs/performance"
fi

# Tuning docs
if [ -d "$SOURCE/docs/tuning" ]; then
    copy_dir "$SOURCE/docs/tuning" "$DEST/docs/tuning"
fi

# API docs (engine-related)
if [ -d "$SOURCE/docs/api" ]; then
    copy_dir "$SOURCE/docs/api" "$DEST/docs/api"
fi

# Design/implementation docs (engine-related)
if [ -d "$SOURCE/docs/design/implementation" ]; then
    mkdir -p "$DEST/docs/design"
    copy_dir "$SOURCE/docs/design/implementation" "$DEST/docs/design/implementation"
fi

# Move ordering docs
if [ -d "$SOURCE/docs/move-ordering" ]; then
    copy_dir "$SOURCE/docs/move-ordering" "$DEST/docs/move-ordering"
fi

# Copy engine assets if they exist
echo ""
echo "=== Copying engine assets ==="
if [ -d "$SOURCE/src/ai" ]; then
    copy_dir "$SOURCE/src/ai" "$DEST/src/ai"
fi

# Create a basic README for the engine repo
echo ""
echo "=== Creating engine README ==="
if [ ! -f "$DEST/README.md" ]; then
    cat > "$DEST/README.md" << 'EOF'
# Shogi Engine

This is the Shogi game engine, implementing the USI (Universal Shogi Interface) protocol.

## Building

```bash
cargo build --release --bin usi-engine
```

## Running

The engine runs as a USI-compatible process, communicating via stdin/stdout.

## Documentation

See the `docs/` directory for detailed documentation.
EOF
    echo "Created README.md"
fi

echo ""
echo "=== Engine files copied successfully ==="
echo "Destination: $DEST"
echo ""
echo "Note: This script copied files but did not initialize a git repository."
echo "To set up the engine repository:"
echo "  cd $DEST"
echo "  git init"
echo "  git add ."
echo "  git commit -m 'Initial engine repository'"


