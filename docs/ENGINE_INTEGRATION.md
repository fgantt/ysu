# Engine Integration

This UI requires a Shogi engine binary to function.

## Engine Location

The engine binary should be:
- Available as a USI-compatible executable
- Referenced in the Tauri configuration
- Bundled with the application or downloaded on first run

## Configuration Storage

Engine configurations (including the built-in engine location) are stored in:
- **macOS/Linux**: `~/.config/shogi-vibe/engines.json`
- **Windows**: `%APPDATA%\shogi-vibe\engines.json`

For complete details on where all configuration is stored (engines, UI settings, wallpapers, etc.), see the [Configuration Storage Guide](user/guides/CONFIGURATION_STORAGE.md).

## Development

For local development, you can:
1. Build the engine from the engine repository
2. Place the binary in the expected location
3. Or configure the UI to use an external engine path

See the engine repository for building instructions.
