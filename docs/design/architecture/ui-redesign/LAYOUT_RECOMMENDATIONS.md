# Game Page Layout Redesign Recommendations

> **Status**: Draft for Review  
> **Date**: 2025-01-27  
> **Related**: See [implementation_plan.md](./implementation_plan.md) for Option 12 (Traditional Symmetry) which was previously considered

## Executive Summary

This document presents three compelling recommendations for replacing the current Classic and Compact layouts with a unified, responsive, and customizable layout system. All recommendations preserve existing features (AI thinking indicators, valid move highlighting, etc.) while adding drag-and-drop customization and responsive behavior.

**Quick Comparison:**
- **Recommendation 1 (CSS Grid)**: Most flexible, modern approach similar to VS Code
- **Recommendation 2 (Flexbox Splitters)**: Simplest implementation, traditional desktop app feel
- **Recommendation 3 (Modular Presets)**: Best UX balance, familiar presets with customization

**Decision Criteria:**
- Choose **#1** if maximum flexibility and future extensibility is priority
- Choose **#2** if simplicity and fast implementation is priority  
- Choose **#3** if user experience and ease of adoption is priority

**Key Requirements:**
- ✅ Default appearance similar to current Compact layout
- ✅ Fully responsive to window resizing
- ✅ User-customizable panel positions (drag-and-drop)
- ✅ Persistent layout preferences between sessions
- ✅ Future-proof for additional analysis sections
- ✅ Preserve all current functionality (AI thinking, valid move highlighting, etc.)

**Requirements Mapping:**

| Requirement | Grid (R1) | Flexbox (R2) | Presets (R3) |
|------------|-----------|--------------|--------------|
| Compact-like default | ✅ Yes | ✅ Yes | ✅ Yes (preset) |
| Responsive | ✅ Excellent | ✅ Good | ✅ Excellent |
| Drag-and-drop | ✅ Full | ⚠️ Limited | ✅ Full (custom mode) |
| Persistent preferences | ✅ Yes | ✅ Yes | ✅ Yes |
| Future extensibility | ✅ Excellent | ✅ Good | ✅ Excellent |
| Feature preservation | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Recommendation 1: CSS Grid with Resizable Panels

### Overview

A modern CSS Grid-based layout system with resizable panel dividers, similar to VS Code or modern IDEs. Panels can be resized by dragging handles and repositioned via drag-and-drop.

### Visual Mockup (Realistic Shogi Set Appearance)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [Window Controls]  Shogi Vibe                                                      │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Background: Serene landscape wallpaper (configurable)                      │   │
│  │                                                                             │   │
│  │  ┌───────┐                              ┌──────────┐  ┌──────────────┐     │   │
│  │  │       │                              │          │  │              │     │   │
│  │  │ GOTE  │                              │ CONTROLS │  │              │     │   │
│  │  │       │                              │ ────────│  │              │     │   │
│  │  │┌─────┐│                              │ [Exit]  │  │              │     │   │
│  │  ││ ☗☗☗ ││                              │ [New]   │  │              │     │   │
│  │  ││     ││                              │ [Save]  │  │              │     │   │
│  │  ││ ☗☗  ││                              │ [Load]  │  │              │     │   │
│  │  ││     ││                              │ [Pieces]│  │              │     │   │
│  │  │└─────┘│                              │ [Board] │  │              │     │   │
│  │  │Komadai│                              │ [Settings]│ │              │     │   │
│  │  │(Square│                              │          │  │              │     │   │
│  │  │ Wood) │                              │ CLOCKS   │  │              │     │   │
│  │  └───────┘                              │ ────────│  │              │     │   │
│  │         │                               │ Gote:   │  │              │     │   │
│  │         │     ╔═══════════════════╗     │ 02:56:16│  │              │     │   │
│  │         │     ║ 9 8 7 6 5 4 3 2 1 ║     │         │  │              │     │   │
│  │         │     ║┌─┬─┬─┬─┬─┬─┬─┬─┬─┐║     │ Sente:  │  │              │     │   │
│  │         │     ║│香│桂│銀│金│玉│金│銀│桂│香│║     │ 02:59:52│  │              │     │   │
│  │         │     ║├─┼─┼─┼─┼─┼─┼─┼─┼─┤║     │         │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ SENTE   │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ ────────│  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ ┌─────┐ │  │              │     │   │
│  │         │     ║│ │ ☖ │ │ │ │ │ │ ☖ │ │║     │ │☖☖☖ │ │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ │     │ │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ │ ☖☖  │ │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ │     │ │  │              │     │   │
│  │         │     ║│☗ │ │ │ │ │ │ │ │☗│║     │ └─────┘ │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ Komadai │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │ (Square │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     │  Wood)  │  │              │     │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║     └──────────┘  └──────────────┘     │   │
│  │         │     ║│ ☗ │ │ │ │ │ │ │ │☗│║                                          │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║                                         │   │
│  │         │     ║│☗☗☗☗☗☗☗☗☗│║                                         │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║                                         │   │
│  │         │     ║│ │ │ │ │ │ │ │ │ │║                                         │   │
│  │         │     ║│香│桂│銀│金│玉│金│銀│桂│香│║                                         │   │
│  │         │     ║└─┴─┴─┴─┴─┴─┴─┴─┴─┘║                                         │   │
│  │         │     ║ a b c d e f g h i ║                                         │   │
│  │         │     ╚═══════════════════╝                                         │   │
│  │         │      (Board with wood texture, configurable piece themes)         │   │
│  │         │                                                                   │   │
│  │         │  [Drag Handle]  ────────────────────────────────────────────────  │   │
│  │         │                                                                   │   │
│  └─────────┴───────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  MOVE LOG  [Collapse ▼]  [Dock ▼]  [Float]                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Move │ Gote │ Sente │                                                │ │   │
│  │  │  1   │ 6i6h │ 8c8d  │                                                │ │   │
│  │  │  2   │ ...  │ ...   │                                                │ │   │
│  │  └───────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  USI MONITOR  [Collapse ▼]  [Dock ▼]  [Float]                              │   │
│  │  [Engine Monitor] [Search Log] [Evaluation Graph]                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ELAPSED │ RANK │ DEPTH │ NODES │ SCORE │ PV                           │ │   │
│  │  │  2.3s   │  1   │  12   │ 1.2M  │ +125  │ 7g7f 5c5d 6h5h             │ │   │
│  │  └───────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘

Key Visual Elements:
- Background: User's selected wallpaper (full-screen)
- Board: Wood texture background with 9x9 grid
- Komadai: Small square wooden stands (top-left for Gote, top-right for Sente)
- Pieces: User's selected piece theme (kanji, english, or custom themes)
- All panels: Resizable via drag handles (│ vertical, ─ horizontal)
- All panels: Can be docked, floated, or collapsed
- Board/Pieces: Fully resizable (scale from 50% to 200% or custom sizes)
```

**Important Design Principles:**
- **Komadai Styling**: Small square wooden stands positioned near each player's side (left for Gote/White, right for Sente/Black), like authentic shogi sets
- **Authentic Appearance**: Board and komadai maintain traditional shogi set proportions and wood textures
- **Visual Continuity**: Wallpapers and backgrounds render behind all panels for immersive experience

### Key Features

#### ✅ Visual Asset Support
1. **Wallpapers & Backgrounds**
   - **Full Support**: All existing wallpapers continue to work
   - **Full-screen Rendering**: Wallpapers render behind all panels for immersive experience
   - **Configurable**: Users can change wallpapers without layout changes
   - **Board Backgrounds**: Separate board texture backgrounds maintained (wood, stone, etc.)

2. **Piece Sets & Themes**
   - **All Themes Supported**: Kanji, English, and all custom piece themes work unchanged
   - **Theme Switching**: Piece themes can be changed dynamically without affecting layout
   - **Visual Consistency**: Pieces maintain their appearance and styling in all panel configurations

#### ✅ Flexible Resizing
3. **Board & Piece Resizing**
   - **Unlimited Scaling**: Board can be resized from 50% to 200% (or custom pixel sizes)
   - **Independent Piece Scaling**: Piece size scales proportionally with board
   - **Aspect Ratio Control**: Optional lock for maintaining traditional shogi proportions
   - **Live Preview**: Real-time visual feedback during resize
   - **Minimum/Maximum Constraints**: Configurable limits to prevent unusable sizes
   - **Saved Preferences**: User's preferred board/piece size saved per session

4. **Panel Resizing**
   - **Resize Handles**: Draggable handles between all panels (│ vertical, ─ horizontal)
   - **Flexible Constraints**: Minimum/maximum size constraints per panel type
   - **Smooth Animations**: Fluid resize animations for better UX
   - **Proportional Resizing**: Optional lock to maintain relative panel sizes

#### ✅ Floating & Docking
5. **Panel Docking System**
   - **Dock Positions**: Panels can be docked to left, right, top, bottom, or center
   - **Dock Tabs**: Multiple panels can share dock areas with tabbed interface
   - **Dock Groups**: Related panels can be grouped together (e.g., Gote Captured + Move Log)
   - **Grid Integration**: Docked panels integrate seamlessly with CSS Grid

6. **Floating Panels**
   - **Floating Windows**: Any panel can be "undocked" and float independently
   - **Position Memory**: Floating panel positions remembered between sessions
   - **Multi-Monitor**: Floating panels can be moved to secondary displays (desktop app)
   - **Always-on-Top**: Optional "pin" to keep floating panels visible

7. **Panel States**
   - **Collapse/Expand**: Panels can be collapsed to thin bars with icons
   - **Auto-Hide**: Panels can auto-hide and reappear on hover
   - **Minimize**: Panels can be minimized to taskbar/system tray area
   - **Double-click Toggle**: Quick collapse/expand via double-click

#### ✅ Authentic Shogi Appearance
8. **Komadai Design**
   - **Square Wooden Stands**: Small square wooden komadai positioned near player sides
   - **Traditional Proportions**: Komadai sized relative to board (typically 1/3 to 1/4 board width)
   - **Positioning**: Gote komadai (top-left), Sente komadai (top-right) - traditional placement
   - **Wood Texture**: Authentic wood grain textures matching real shogi sets
   - **Piece Organization**: Captured pieces arranged neatly within square komadai
   - **Responsive Sizing**: Komadai scale proportionally when board resizes

9. **Board Styling**
   - **Traditional 9x9 Grid**: Maintains authentic shogi board proportions
   - **Wood Textures**: Configurable board backgrounds (wood, stone, fabric)
   - **Piece Placement**: Pieces positioned and sized like real shogi pieces
   - **Visual Hierarchy**: Board remains the focal point, komadai secondary

#### 🎯 Layout Flexibility
10. **CSS Grid Layout**
    - Main container uses CSS Grid with named areas
    - Grid areas: `gote-komadai`, `board`, `controls`, `clocks`, `sente-komadai`, `move-log`, `usi-monitor`
    - Responsive grid that adapts to window size
    - Dynamic grid recalculation for custom arrangements

11. **Drag-and-Drop Repositioning**
    - Panels can be dragged to different grid positions
    - Visual feedback during drag (ghost outline, drop zones)
    - Grid automatically adjusts to accommodate new positions
    - Snap-to-grid option for alignment

### Implementation Plan

#### Phase 1: Core Grid System (Week 1-2)

1. **Create Layout Component Structure**
   ```typescript
   // src/components/GameLayout/GridLayout.tsx
   - GridLayout container component
   - Panel components (wrappers for existing components)
   - ResizeHandle component
   - FloatingPanelWrapper component
   - DockManager component
   ```

2. **CSS Grid Setup with Wallpaper Support**
   ```css
   .game-layout-grid {
     position: relative;
     width: 100vw;
     height: 100vh;
     /* Wallpaper renders behind grid */
   }
   
   .game-layout-background {
     position: fixed;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     background-image: var(--wallpaper-url);
     background-size: cover;
     background-position: center;
     background-attachment: fixed;
     z-index: -1;
   }
   
   .game-layout-grid {
     display: grid;
     grid-template-columns: 
       [gote-komadai-start] minmax(150px, 250px) [gote-komadai-end board-start] 
       minmax(600px, 1fr) [board-end sente-komadai-start] 
       minmax(150px, 250px) [sente-komadai-end controls-start]
       minmax(200px, 300px) [controls-end];
     grid-template-rows: 
       [top-start] minmax(180px, 220px) [top-end board-start] 
       minmax(600px, 1fr) [board-end bottom-start] 
       minmax(200px, 300px) [bottom-end monitor-start] 
       minmax(150px, 250px) [monitor-end];
     gap: 10px;
     padding: 10px;
   }
   ```

3. **Panel Component Wrapper with Floating/Docking**
   ```typescript
   interface PanelProps {
     id: string;
     title?: string;
     collapsible?: boolean;
     floatable?: boolean;  // Can float independently
     dockable?: boolean;   // Can dock to sides
     minWidth?: number;
     minHeight?: number;
     defaultWidth?: number;
     defaultHeight?: number;
     position?: 'docked' | 'floating' | 'minimized';
     floatingPosition?: { x: number; y: number };
   }
   ```

4. **Board & Piece Resizing System**
   ```typescript
   interface BoardResizeState {
     scale: number;  // 0.5 to 2.0 (50% to 200%)
     width?: number; // Optional pixel width
     height?: number; // Optional pixel height
     maintainAspectRatio: boolean;
     pieceScale: number; // Proportional piece scaling
   }
   
   // Board component accepts scale prop
   <Board 
     position={position}
     scale={boardResizeState.scale}
     pieceThemeType={pieceLabelType}
     boardBackground={boardBackground}
     // ... other props
   />
   ```

5. **Komadai Component (Authentic Shogi Styling)**
   ```typescript
   interface KomadaiProps {
     player: 'player1' | 'player2';  // Sente or Gote
     captured: Hand;
     position: 'left' | 'right';  // Gote left, Sente right
     size: 'small' | 'medium' | 'large';  // Relative to board
     woodTexture?: string;  // Wood texture image
   }
   
   // Komadai styled as small square wooden stand
   // Typical size: 1/3 to 1/4 of board width
   // Positioned near player's side (top-left for Gote, top-right for Sente)
   ```

#### Phase 2: Resize & Floating/Docking System (Week 2-3)

1. **Board & Piece Resize Functionality**
   ```typescript
   // Board resize controls
   - Resize slider: 50% to 200% scale
   - Pixel-based resize: Direct width/height input
   - Aspect ratio lock toggle
   - Piece scaling: Automatic or independent control
   - Live preview during resize
   - Save preference: `shogi-board-scale`
   ```

2. **Panel Resize Handle Component**
   - Mouse/touch event handlers for resize handles
   - Calculate new grid sizes on drag
   - Update CSS custom properties for grid column/row sizes
   - Debounce resize events for performance (100ms)
   - Visual feedback: cursor changes, resize guides
   - Minimum/maximum constraints per panel type

3. **Floating Panel System**
   ```typescript
   interface FloatingPanelState {
     panelId: string;
     position: { x: number; y: number };
     size: { width: number; height: number };
     zIndex: number;
     alwaysOnTop: boolean;
   }
   
   // FloatingPanelWrapper component
   - Window-like floating container
   - Drag handle on title bar
   - Close/minimize/restore buttons
   - Resize handles on corners/edges
   - Position tracking and memory
   ```

4. **Docking System**
   ```typescript
   interface DockState {
     panelId: string;
     dockSide: 'left' | 'right' | 'top' | 'bottom' | 'center' | null;
     dockIndex: number;  // Position within dock
     isTabbed: boolean;  // Part of tabbed group
     tabGroup?: string;  // Tab group identifier
   }
   
   // DockManager component
   - Drop zones for docking
   - Visual feedback: highlight dock areas
   - Tab management for grouped panels
   - Dock splitting (side-by-side or stacked)
   ```

5. **State Management**
   ```typescript
   interface LayoutState {
     boardScale: number;  // Board resize scale
     pieceScale: number;  // Piece resize scale (if independent)
     panels: {
       [panelId: string]: {
         width?: number;
         height?: number;
         collapsed: boolean;
         position: { row: number; col: number };
         floatState?: FloatingPanelState;
         dockState?: DockState;
       };
     };
     wallpaper: string;  // Current wallpaper URL
     boardBackground: string;  // Current board texture
     pieceTheme: string;  // Current piece theme
   }
   ```

6. **Persistence**
   - Save layout state to localStorage
   - Key: `shogi-game-layout-state` (versioned)
   - Separate keys for:
     - `shogi-board-scale`: Board size preference
     - `shogi-piece-scale`: Piece size preference
     - `shogi-wallpaper`: Current wallpaper
     - `shogi-board-background`: Board texture
     - `shogi-piece-theme`: Piece theme
   - Load on mount, save on change
   - Migration from old `shogi-game-layout` preference

#### Phase 3: Drag-and-Drop & Komadai Styling (Week 3-4)

1. **Panel Drag System**
   - Use React DnD or native HTML5 drag-and-drop
   - Visual feedback: ghost element, drop zones, dock highlights
   - Calculate valid drop positions in grid
   - Support drag-to-float (undock) and drag-to-dock

2. **Grid Recalculation**
   - Dynamically update grid-template-areas based on panel positions
   - Maintain aspect ratios where possible
   - Handle edge cases (too many panels, small window)
   - Smooth transitions when grid layout changes

3. **Komadai Component Implementation**
   ```typescript
   // src/components/GameLayout/Komadai.tsx
   - Square wooden stand component
   - Traditional shogi komadai proportions (1/3 to 1/4 board width)
   - Wood texture background (configurable)
   - Captured pieces organized within square bounds
   - Positioned near player side (top-left Gote, top-right Sente)
   - Scales proportionally with board resize
   ```

4. **Komadai Styling**
   ```css
   .komadai {
     width: calc(var(--board-width) * 0.3);  /* 30% of board width */
     aspect-ratio: 1;  /* Square komadai */
     background: url('wood-texture.png');
     background-size: cover;
     border: 2px solid rgba(101, 67, 33, 0.8);  /* Dark wood border */
     border-radius: 4px;
     box-shadow: 
       inset 0 2px 4px rgba(0, 0, 0, 0.3),
       0 4px 8px rgba(0, 0, 0, 0.2);  /* Depth effect */
     padding: 8px;
   }
   
   .komadai.gote {
     /* Top-left positioning */
     grid-area: gote-komadai;
   }
   
   .komadai.sente {
     /* Top-right positioning */
     grid-area: sente-komadai;
   }
   
   .komadai-pieces {
     display: flex;
     flex-wrap: wrap;
     gap: 4px;
     justify-content: flex-start;
     align-items: flex-start;
     min-height: 120px;
   }
   ```

5. **Visual Asset Integration**
   - Wallpaper renders behind all panels (z-index: -1)
   - Board background applies to board component only
   - Piece themes apply via existing theme system
   - No changes required to existing asset loading
   - All assets remain in current locations (`public/boards/`, `public/piece-themes/`, `public/wallpapers/`)

#### Phase 4: Responsive Behavior (Week 4)
1. **Breakpoints**
   - Desktop (>1200px): Full grid layout
   - Tablet (768px-1200px): Simplified 2-column grid
   - Mobile (<768px): Single column stack

2. **Adaptive Panel Sizing**
   - Auto-collapse less critical panels on small screens
   - Priority system: Board > Captured Pieces > Move Log > Controls > Monitor

#### Phase 5: Migration (Week 5)
1. **Backward Compatibility**
   - Detect existing `shogi-game-layout` preference
   - Map 'compact' to default grid layout
   - Migrate user preferences to new format

2. **Feature Parity**
   - Ensure all existing features work
   - Test AI thinking indicators
   - Test valid move highlighting
   - Test all game controls

### Pros
- ✅ **Modern, flexible layout system**: CSS Grid provides maximum flexibility
- ✅ **Excellent responsive behavior**: Adapts seamlessly to window resizing
- ✅ **Professional appearance**: Similar to VS Code or modern IDEs
- ✅ **Easy to add new panels**: Grid system accommodates new panels easily
- ✅ **Smooth resize animations**: Fluid UI interactions
- ✅ **Well-supported by browsers**: CSS Grid widely supported
- ✅ **Full asset compatibility**: All existing wallpapers, backgrounds, and piece themes work unchanged
- ✅ **Unlimited resizing**: Board and pieces can scale from 50% to 200% (or custom sizes)
- ✅ **Floating & docking**: Panels can float independently or dock to sides
- ✅ **Authentic komadai**: Small square wooden stands positioned traditionally near player sides

### Cons
- ⚠️ **More complex initial implementation**: Requires more development time
- ⚠️ **Requires careful state management**: Layout state, floating panels, docking, and resizing all need coordination
- ⚠️ **Grid recalculation can be performance-intensive**: Need optimization for smooth resize operations
- ⚠️ **Learning curve for drag-and-drop UX**: Users need to learn floating/docking interactions
- ⚠️ **Floating panels add complexity**: Window management for floating panels requires additional logic

### Answers to Specific Questions

**Q: Allow the continued use of the current wallpapers, backgrounds, and piece sets?**
✅ **YES** - All existing visual assets work unchanged:
- Wallpapers: Render behind all panels via `background-attachment: fixed`
- Board backgrounds: Apply to board component only (wood textures, etc.)
- Piece themes: All existing themes (kanji, english, custom) work without modification
- Asset locations remain the same: `public/boards/`, `public/piece-themes/`, `public/wallpapers/`

**Q: Will the pieces and boards be able to resize as small or large as the user wants?**
✅ **YES** - Full resizing support:
- Board scale: 50% to 200% (or custom pixel dimensions)
- Piece scaling: Proportional to board or independent control
- Aspect ratio: Optional lock to maintain traditional proportions
- Live preview during resize
- Saved preferences per session

**Q: Can some sections be floated or docked?**
✅ **YES** - Complete floating and docking system:
- **Docking**: Panels can dock to left, right, top, bottom, or center
- **Floating**: Any panel can undock and float as independent window
- **Tabbed groups**: Multiple panels can share dock areas with tabs
- **Position memory**: Floating panel positions remembered between sessions
- **Always-on-top**: Optional pin for floating panels
- **Minimize**: Panels can be minimized to taskbar area

**Q: Board and captured pieces blocks should have the same relative look as real shogi sets**
✅ **YES** - Authentic komadai styling:
- **Square komadai**: Small square wooden stands (1/3 to 1/4 board width)
- **Traditional positioning**: Gote komadai top-left, Sente komadai top-right
- **Wood textures**: Authentic wood grain textures matching real shogi sets
- **Proportional sizing**: Komadai scale with board resize
- **Piece organization**: Captured pieces neatly arranged within square komadai
- **Visual hierarchy**: Board is focal point, komadai secondary (authentic appearance)

### Migration Path

1. **Create new components alongside existing**
   - `src/components/GameLayout/` directory
   - Keep existing `GamePage.tsx` intact initially

2. **Feature flag**
   - Add `useNewLayout` flag in settings
   - Allow users to opt-in to new layout
   - Default to false initially

3. **Gradual migration**
   - Migrate one panel at a time
   - Test thoroughly before moving to next
   - Keep old layout code until fully migrated

---

## Recommendation 2: Flexbox with Splitter Panels

### Overview

A traditional desktop application approach using Flexbox containers with resizable splitter panels. Similar to traditional IDEs like Eclipse or IntelliJ IDEA. Simpler than Grid but still powerful.

### Visual Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Window Controls]  Shogi Vibe                                      │
├──────────┬──────────────────────────────┬──────────────────────────┤
│          │                              │                          │
│  GOTE    │                              │  CONTROLS                │
│ Captured │                              │  [Exit] [New] [Save]     │
│ Pieces   │                              │  [Load] [Pieces] [Board] │
│          │                              │                          │
│          │        GAME BOARD            │  CLOCKS                 │
│          │      (9x9 Shogi Grid)        │  Gote: 02:56:16         │
│          │                              │  Sente: 02:59:52         │
│          │                              │                          │
│          │                              │  SENTE                   │
│          │                              │  Captured                │
│          │                              │  Pieces                  │
│          │                              │                          │
├──────────┴──────────────────────────────┴──────────────────────────┤
│  MOVE LOG                                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Move │ Gote │ Sente │                                        │  │
│  │  1   │ 6i6h │ 8c8d  │                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  USI MONITOR (Collapsible)                                         │
│  [Engine Monitor] [Search Log] [Evaluation Graph]                  │
└─────────────────────────────────────────────────────────────────────┘

Splitter Handles: ║ (vertical) and ═ (horizontal) - thicker, more visible
```

### Key Features

1. **Flexbox Containers**
   - Main container: vertical flex
   - Top section: horizontal flex (3 columns)
   - Bottom section: horizontal flex (move log + monitor)

2. **Splitter Components**
   - Thick, visible resize handles
   - Click and drag to resize
   - Double-click to reset to default size
   - Visual feedback (cursor change, highlight)

3. **Panel Management**
   - Panels can be hidden/shown via context menu
   - Panels can be docked to different sides
   - Floating panels (future enhancement)

4. **Responsive Behavior**
   - Panels stack vertically on small screens
   - Minimum widths enforced
   - Auto-hide less critical panels

### Implementation Plan

#### Phase 1: Flexbox Structure (Week 1)
1. **Container Hierarchy**
   ```typescript
   <FlexContainer direction="vertical">
     <FlexContainer direction="horizontal">
       <Panel id="gote-captured" />
       <Splitter />
       <Panel id="board" flex="1" />
       <Splitter />
       <Panel id="right-sidebar" />
     </FlexContainer>
     <Splitter />
     <FlexContainer direction="horizontal">
       <Panel id="move-log" flex="1" />
       <Splitter />
       <Panel id="usi-monitor" />
     </FlexContainer>
   </FlexContainer>
   ```

2. **Splitter Component**
   ```typescript
   interface SplitterProps {
     direction: 'horizontal' | 'vertical';
     onResize: (delta: number) => void;
     minSize?: number;
     maxSize?: number;
   }
   ```

#### Phase 2: Resize Logic (Week 2)
1. **Mouse Event Handling**
   - Track mouse down on splitter
   - Calculate delta during mouse move
   - Update panel sizes via flex-basis
   - Handle mouse up to end resize

2. **Size Constraints**
   - Enforce minimum panel sizes
   - Prevent panels from becoming too small
   - Snap to common sizes (optional)

#### Phase 3: Panel State (Week 2-3)
1. **Collapse/Expand**
   - Toggle panel visibility
   - Store collapsed state
   - Show collapsed panel as thin bar

2. **Panel Ordering**
   - Allow panels to swap positions
   - Drag panel headers to reorder
   - Update flex order property

#### Phase 4: Persistence (Week 3)
1. **Save Layout**
   ```typescript
   interface SavedLayout {
     panels: {
       [id: string]: {
         width?: number;
         height?: number;
         visible: boolean;
         order: number;
       };
     };
   }
   ```

2. **Load on Mount**
   - Read from localStorage
   - Apply saved sizes
   - Restore panel visibility

#### Phase 5: Responsive (Week 4)
1. **Media Queries**
   - Stack panels on mobile
   - Hide less important panels
   - Adjust splitter behavior

2. **Touch Support**
   - Touch events for mobile
   - Larger hit areas for splitters
   - Swipe gestures (optional)

### Pros
- ✅ Simpler implementation than Grid
- ✅ Familiar desktop app pattern
- ✅ Good performance
- ✅ Easy to understand and maintain
- ✅ Works well with existing Flexbox knowledge

### Cons
- ⚠️ Less flexible than Grid for complex layouts
- ⚠️ More difficult to rearrange panels dramatically
- ⚠️ Requires careful flex-basis management
- ⚠️ Can be less intuitive for some users

### Migration Path

1. **Refactor existing compact layout**
   - Convert to Flexbox structure
   - Add splitters between panels
   - Maintain current visual appearance

2. **Incremental enhancement**
   - Start with fixed splitters
   - Add resize functionality
   - Add drag-and-drop later

3. **Backward compatibility**
   - Keep classic layout as fallback
   - Migrate preferences automatically

---

## Recommendation 3: Modular Component System with Layout Presets

### Overview

A hybrid approach combining predefined layout templates with customizable panel positions. Users can choose from preset layouts (similar to current Classic/Compact) but also customize panel positions. Best of both worlds: simplicity of presets with flexibility of customization.

### Visual Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Window Controls]  Shogi Vibe  [Layout: Compact ▼] [Customize]   │
├──────────┬──────────────────────────────┬──────────────────────────┤
│          │                              │                          │
│  GOTE    │                              │  CONTROLS                │
│ Captured │                              │  [Exit] [New] [Save]     │
│ Pieces   │                              │  [Load] [Pieces] [Board] │
│          │                              │                          │
│          │        GAME BOARD            │  CLOCKS                 │
│          │      (9x9 Shogi Grid)        │  Gote: 02:56:16         │
│          │                              │  Sente: 02:59:52         │
│          │                              │                          │
│          │                              │  SENTE                   │
│          │                              │  Captured                │
│          │                              │  Pieces                  │
│          │                              │                          │
├──────────┴──────────────────────────────┴──────────────────────────┤
│  MOVE LOG                                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Move │ Gote │ Sente │                                        │  │
│  │  1   │ 6i6h │ 8c8d  │                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  USI MONITOR (Collapsible)                                         │
│  [Engine Monitor] [Search Log] [Evaluation Graph]                  │
└─────────────────────────────────────────────────────────────────────┘

Layout Presets: Compact | Classic | Analysis | Custom
Customize Mode: Click to enter, drag panels, save as new preset
```

### Key Features

1. **Layout Presets**
   - **Compact**: Current compact layout (default)
   - **Classic**: Current classic layout
   - **Analysis**: Optimized for analysis (larger monitor, smaller board)
   - **Custom**: User's saved custom layout

2. **Customization Mode**
   - Toggle "Customize" button to enter edit mode
   - Panels become draggable
   - Visual grid overlay for alignment
   - Save custom layout as new preset

3. **Panel System**
   - Each panel is a self-contained component
   - Panels can be shown/hidden
   - Panels can be resized (when in custom mode)
   - Panels maintain their own state

4. **Responsive Presets**
   - Each preset has mobile/tablet variants
   - Automatically switch based on window size
   - User can override with custom responsive rules

### Implementation Plan

#### Phase 1: Layout Preset System (Week 1-2)
1. **Preset Definitions**
   ```typescript
   interface LayoutPreset {
     id: string;
     name: string;
     description: string;
     layout: PanelLayout;
     responsive?: {
       [breakpoint: string]: PanelLayout;
     };
   }

   interface PanelLayout {
     panels: {
       [panelId: string]: {
         position: { x: number; y: number; width: number; height: number };
         visible: boolean;
         zIndex: number;
       };
     };
   }
   ```

2. **Preset Registry**
   ```typescript
   const LAYOUT_PRESETS: LayoutPreset[] = [
     {
       id: 'compact',
       name: 'Compact',
       layout: { /* compact layout definition */ }
     },
     {
       id: 'classic',
       name: 'Classic',
       layout: { /* classic layout definition */ }
     },
     // ... more presets
   ];
   ```

3. **Preset Selector UI**
   - Dropdown in header
   - Preview thumbnails
   - Quick switch between presets

#### Phase 2: Panel Component System (Week 2-3)
1. **Panel Wrapper**
   ```typescript
   interface GamePanelProps {
     id: string;
     title: string;
     children: React.ReactNode;
     resizable?: boolean;
     draggable?: boolean;
     collapsible?: boolean;
     defaultSize?: { width: number; height: number };
   }
   ```

2. **Panel Registry**
   ```typescript
   const GAME_PANELS = {
     'gote-captured': <CapturedPieces player="player2" />,
     'board': <Board />,
     'sente-captured': <CapturedPieces player="player1" />,
     'controls': <GameControls />,
     'clocks': <Clock />,
     'move-log': <MoveLog />,
     'usi-monitor': <UsiMonitor />,
   };
   ```

#### Phase 3: Customization Mode (Week 3-4)
1. **Edit Mode Toggle**
   - Button to enter/exit customization mode
   - Visual indicator when in edit mode
   - Panels become draggable/resizable

2. **Drag-and-Drop**
   - Use React DnD or similar
   - Snap to grid (optional)
   - Visual feedback during drag

3. **Save Custom Layout**
   - "Save as Preset" button
   - Name and describe custom layout
   - Store in localStorage
   - Add to preset list

#### Phase 4: Responsive Behavior (Week 4)
1. **Breakpoint System**
   ```typescript
   const BREAKPOINTS = {
     mobile: 768,
     tablet: 1024,
     desktop: 1200,
   };
   ```

2. **Responsive Presets**
   - Each preset can have mobile/tablet variants
   - Auto-switch based on window size
   - User can lock to specific preset

3. **Adaptive Panels**
   - Panels can hide on small screens
   - Panels can change size based on breakpoint
   - Priority system for panel visibility

#### Phase 5: Migration (Week 5)
1. **Convert Existing Layouts**
   - Map 'compact' to Compact preset
   - Map 'classic' to Classic preset
   - Preserve user preferences

2. **Feature Parity**
   - Ensure all features work in all presets
   - Test thoroughly
   - Document preset differences

### Pros
- ✅ Best of both worlds (presets + customization)
- ✅ Familiar to users (similar to current system)
- ✅ Easy to add new presets
- ✅ Lower learning curve
- ✅ Good defaults for new users
- ✅ Flexible for power users

### Cons
- ⚠️ More code to maintain (presets + customization)
- ⚠️ Need to design good preset defaults
- ⚠️ Custom layouts might not work well on all screen sizes
- ⚠️ More complex state management

### Migration Path

1. **Create preset system first**
   - Define Compact and Classic presets
   - Match current layouts exactly
   - Test feature parity

2. **Add customization gradually**
   - Start with preset switching
   - Add show/hide panels
   - Add drag-and-drop last

3. **User migration**
   - Auto-detect current layout preference
   - Map to appropriate preset
   - Allow customization from there

---

## Comparison Matrix

| Feature | Grid with Resizable | Flexbox with Splitters | Modular Presets |
|---------|-------------------|----------------------|----------------|
| **Complexity** | High | Medium | Medium-High |
| **Flexibility** | Very High | Medium | High |
| **Ease of Use** | Medium | High | High |
| **Performance** | Good | Excellent | Good |
| **Responsive** | Excellent | Good | Excellent |
| **Customization** | Full | Limited | Full (with presets) |
| **Learning Curve** | Medium | Low | Low-Medium |
| **Future Extensibility** | Excellent | Good | Excellent |
| **Implementation Time** | 5 weeks | 4 weeks | 5 weeks |
| **Maintenance** | Medium | Low | Medium |

---

## Recommendation Summary

### For Maximum Flexibility: **Recommendation 1 (CSS Grid)**
Best choice if you want the most modern, flexible system that can handle any future layout requirements. Similar to professional IDEs.

### For Simplicity and Speed: **Recommendation 2 (Flexbox Splitters)**
Best choice if you want a simpler implementation that's easier to maintain and performs well. Familiar desktop app pattern.

### For Best User Experience: **Recommendation 3 (Modular Presets)**
Best choice if you want to balance ease of use with flexibility. Users get good defaults but can customize when needed.

---

## Next Steps

1. **Review and Select**: Choose one recommendation based on priorities
2. **Detailed Design**: Create detailed component specifications
3. **Prototype**: Build a minimal prototype to validate approach
4. **Implementation Plan**: Break down into detailed tasks
5. **User Testing**: Test with users before full implementation

---

## Appendix: Technical Considerations

### State Management
All recommendations will need:
- Layout state management (React Context or Zustand)
- Persistence layer (localStorage with versioning)
- Debounced resize handlers
- Window resize listeners

### Performance
- Use `useMemo` for expensive calculations
- Debounce resize events (100-200ms)
- Virtual scrolling for long move logs
- Lazy load analysis panels

### Accessibility
- Keyboard navigation for panel management
- Screen reader support
- Focus management
- ARIA labels for panels

### Browser Support
- CSS Grid: All modern browsers (IE11 not required)
- Flexbox: Universal support
- Drag-and-Drop: Native HTML5 or React DnD fallback

