# Configuration Storage Guide

This document explains where Shogi Vibe stores application configuration and user settings.

## Overview

Shogi Vibe stores configuration in two separate locations:

1. **Engine Configurations** - Stored in a JSON file on disk (managed by Rust backend)
2. **UI Settings** - Stored in browser localStorage (managed by TypeScript frontend)

Both storage locations persist across application restarts and are tied to your user account, not the project directory. This means configuration persists even when you move or rename the project folder.

---

## 1. Engine Configurations

### Storage Location

Engine configurations (including the built-in engine location, external engines, and engine options) are stored in a platform-specific JSON file:

- **macOS/Linux**: `~/.config/shogi-vibe/engines.json`
- **Windows**: `%APPDATA%\shogi-vibe\engines.json`

### What's Stored

The `engines.json` file contains:

- **Engine ID** - Unique identifier for each engine
- **Engine Name** - Display name and internal name
- **Engine Path** - File system path to the engine executable
- **Built-in Flag** - Whether this is the bundled built-in engine
- **Metadata** - Engine author, version, supported options (from USI `id` commands)
- **Saved Options** - User-configured engine options (e.g., `USI_Threads`, `USI_Hash`)
- **Favorite Status** - Which engine is marked as favorite
- **Last Used** - Timestamp of when the engine was last used
- **Enabled Status** - Whether the engine is currently enabled

### Example Structure

```json
{
  "version": "1.0",
  "engines": [
    {
      "id": "uuid-here",
      "name": "Built-in Engine",
      "display_name": "Built-in Engine",
      "path": "/path/to/usi-engine",
      "is_builtin": true,
      "enabled": true,
      "is_favorite": true,
      "created_at": "2024-01-01T00:00:00Z",
      "last_used": "2024-01-15T12:30:00Z",
      "metadata": {
        "name": "Shogi Engine",
        "author": "Your Name"
      },
      "saved_options": {
        "USI_Threads": "4",
        "USI_Hash": "512"
      }
    }
  ]
}
```

### Management

- **Automatic**: The built-in engine is automatically registered on first launch
- **Manual**: External engines are added/removed through the Engine Settings UI
- **Backend**: Managed by Rust code in `src-tauri/src/engine_storage.rs`

---

## 2. UI Settings (localStorage)

### Storage Location

UI settings are stored in browser localStorage, which Tauri persists to disk. The exact location depends on your platform and Tauri's internal storage mechanism:

- **macOS**: `~/Library/Application Support/com.shogigame.app/` (or similar)
- **Linux**: `~/.local/share/com.shogigame.app/` (or similar)
- **Windows**: `%APPDATA%\com.shogigame.app\` (or similar)

The app identifier `com.shogigame.app` comes from `src-tauri/tauri.conf.json`.

### What's Stored

The following settings are persisted in localStorage:

#### Visual Settings
- `shogi-wallpaper` - Selected background wallpaper
- `shogi-board-background` - Selected board background image
- `shogi-piece-label-type` - Piece theme (e.g., 'kanji', 'english')
- `shogi-game-layout` - Layout preference ('classic' or 'compact')
- `shogiVibeTheme` - Application theme (light, dark, traditional, etc.)

#### Game Settings
- `shogi-notation` - Notation preference ('kifu', 'western', 'usi', 'csa')
- `shogi-show-attacked-pieces` - Show/hide attacked pieces indicator
- `shogi-show-piece-tooltips` - Show/hide piece tooltips
- `shogi-show-engine-thinking` - Show/hide engine thinking display

#### Audio Settings
- `shogi-sounds-enabled` - Sound effects enabled/disabled
- `shogi-sound-volume` - Sound volume (0.0 to 1.0)

#### Engine Preferences
- `shogi-recommendation-engine-id` - Engine ID for move recommendations
- `shogi-recommendation-engine-options` - Options for recommendation engine

#### Game State
- `shogi-new-game-settings` - Default settings for new games (player types, time controls, etc.)
- `shogi-usi-monitor-state` - USI monitor visibility and active tab
- `shogi-window-size` - Last window size
- `shogi-saved-games` - Saved game positions

### Management

- **Automatic**: Settings are saved automatically when changed in the UI
- **Frontend**: Managed by TypeScript code using `localStorage.setItem()` and `localStorage.getItem()`
- **Utilities**: Helper functions in `src/utils/persistence.ts` provide safe read/write operations

---

## Why Configuration Persists After Project Split

When you split the project into separate engine and UI repositories, your configuration persisted because:

1. **Engine configurations** are stored in `~/.config/shogi-vibe/` (or Windows equivalent), which is outside any project directory
2. **UI settings** are stored in Tauri's app data directory based on the app identifier (`com.shogigame.app`), not the project location
3. Both storage locations are tied to your user account and the app identifier, not the project folder

This is the intended behavior - configuration should persist across:
- Project moves/renames
- Project splits/merges
- Application updates
- Development vs. production builds (when using the same app identifier)

---

## Accessing Configuration Files

### Engine Configuration

To view or manually edit engine configurations:

```bash
# macOS/Linux
cat ~/.config/shogi-vibe/engines.json

# Windows (PowerShell)
Get-Content $env:APPDATA\shogi-vibe\engines.json
```

**Warning**: Manual edits may cause issues if the JSON is malformed. Prefer using the Engine Settings UI.

### UI Settings (localStorage)

localStorage data is stored in a SQLite database or similar format by Tauri. Direct file access is not recommended. Instead:

- Use browser DevTools (if running in dev mode with a browser)
- Use the application's Settings UI to change preferences
- Clear settings by resetting them in the UI

---

## Troubleshooting

### Configuration Not Persisting

1. **Check file permissions**: Ensure the config directory is writable
   ```bash
   # macOS/Linux
   ls -la ~/.config/shogi-vibe/
   ```

2. **Check disk space**: Insufficient disk space can prevent writes

3. **Check app identifier**: If the app identifier changed, settings will be in a new location

### Reset Configuration

To reset all configuration:

1. **Engine configurations**: Delete `engines.json` (the built-in engine will be re-registered on next launch)
   ```bash
   rm ~/.config/shogi-vibe/engines.json
   ```

2. **UI settings**: Clear localStorage through the application or delete Tauri's app data directory

### Migration After Project Split

If you need to migrate configuration between projects:

1. **Engine configs**: Copy `engines.json` to the new location (same path, so it should already be there)
2. **UI settings**: These are tied to the app identifier - if it changed, you'll need to reconfigure or manually migrate the localStorage data

---

## Related Documentation

- [Engine Integration Guide](../ENGINE_INTEGRATION.md) - How engines are integrated
- [Tauri Migration Tasks](../../development/tasks/prd-tauri-migration-and-usi-integration.md) - Technical implementation details
- [User Guide](USER_GUIDE.md) - General user documentation

---

## Technical Implementation

### Engine Storage (Rust)

- **File**: `src-tauri/src/engine_storage.rs`
- **Functions**: `EngineStorage::load()`, `EngineStorage::save()`, `EngineStorage::get_storage_path()`
- **Format**: JSON with pretty printing

### UI Storage (TypeScript)

- **File**: `src/utils/persistence.ts`
- **Functions**: `safeRead()`, `safeWrite()`, `safeRemove()`
- **Format**: Browser localStorage (key-value pairs, JSON for complex objects)

