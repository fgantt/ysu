# Implementation Plan: Traditional Symmetry Layout (Option 12)

This plan outlines the technical steps to replace the existing 'compact' and 'classic' layouts with the new **Traditional Symmetry** design. All changes will be implemented in `src/components/`, ensuring full feature parity and responsiveness.

# [Goal Description]
Replace current game layouts with a unified "Option 12" design featuring:
1.  **Diagonal Symmetry:** Square wooden Komadai (captured piece stands) for Gote (Top-Left) and Sente (Bottom-Right).
2.  **3-Column Structure:** Clearly defined Left (Gote), Center (Board), and Right (Sente) zones.
3.  **Integrated Analytics:** A persistent, tabbed bottom panel for USI/Engine/Search data.
4.  **Responsiveness:** Fluid adaptation to window size changes.

## User Review Required
> [!IMPORTANT]
> This change will **remove** the ability to switch between 'Classic' and 'Compact' layouts. The new layout will be the single, unified interface.

## Proposed Changes

### 1. Component Architecture Refactor
We will decompose the monolithic `GamePage` render logic into structured sub-components to support the grid layout.

#### [NEW] `src/components/GameLayout/`
Create a new directory to house layout-specific components.
-   `TraditionalLayout.tsx`: The main grid container.
-   `KomadaiBoard.tsx`: A new visual component rendering captured pieces on a square "wooden" background (replacing the simple list view).
-   `PlayerZone.tsx`: A generic wrapper for the player columns (Clock + Komadai + Info).
-   `BottomPanel.tsx`: A tabbed container for the USI Monitor and Graph.

### 2. CSS Grid Implementation
Modify `src/components/GamePage.css` to implement the specific layout requirements.

**Grid Areas Strategy:**
```css
.game-container {
  display: grid;
  grid-template-areas:
    "gote-col board sente-col"
    "bottom   bottom bottom";
  grid-template-columns: 280px 1fr 280px; /* Fixed sidebars, fluid board */
  grid-template-rows: 1fr auto;
  height: 100vh;
}
```

-   **Gote Column (`gote-col`):** Flex column, content aligned `flex-start`.
-   **Sente Column (`sente-col`):** Flex column, content aligned `flex-end`.
-   **Board (`board`):** Centered, maintaining aspect ratio.
-   **Bottom (`bottom`):** Collapsible/Resizable panel for analytics.

### 3. "Square Komadai" Component
The distinguishing feature of Option 12.
-   **Visuals:** Use a background texture/color resembling the Shogi board wood.
-   **Layout:** Grid of captured pieces (Pawn, Lance, Knight, Silver, Gold, Bishop, Rook) arranged nicely within the square.
-   **Interaction:** Full drag-and-drop support (using existing `dnd` handlers).

### 4. Code Modifications

#### [MODIFY] [GamePage.tsx](file:///Users/fgantt/projects/vibe/shogi-game/ysu-worktrees/ui-responsive/src/components/GamePage.tsx)
-   Remove `gameLayout` state toggle logic.
-   Replace the `if (gameLayout === 'compact') ...` conditional rendering with the new `TraditionalLayout` structure.
-   Lift state required by sub-components (tabs, sizing) if not already available.

#### [MODIFY] [GamePage.css](file:///Users/fgantt/projects/vibe/shogi-game/ysu-worktrees/ui-responsive/src/components/GamePage.css)
-   Remove `.game-page-compact` and `.game-page-classic` specific styles.
-   Add `.traditional-layout` grid definitions.
-   Add styling for `.komadai-board` (wooden texture, shadow, rounded corners).

## Verification Plan

### Automated Tests
-   Verify existing component tests pass (they shouldn't rely on layout specific class names ideally, but might need updates).
-   Ensure piece dropping logic still fires correctly from the new `KomadaiBoard`.

### Manual Verification
1.  **Layout Check:** Verify Gote's Komadai is Top-Left and Sente's is Bottom-Right.
2.  **Responsiveness:** Resize window.
    -   *Desktop:* 3-Column view.
    -   *Tablet/Small:* Side columns might need to wrap or the board shrinks.
3.  **Feature Parity Check:**
    -   Clicking pieces in new Komadai selects them.
    -   Clocks count down correctly.
    -   USI Monitor tabs switch content correctly.
    -   Settings/Menu buttons (now in Top-Right) work.
