# Analysis panels roadmap

Saved October 4, 2026. All work currently belongs to `codex/ui-codex-1`.

## First delivery: Candidate Moves and Continuation Board

Candidate Moves reads the existing game/recommendation engine searches, groups up to five reported MultiPV lines per engine, and shows evaluations, depth, elapsed time, nodes, and continuations. It can be docked, floated, minimized, or popped into a native window. The embedded Continuation Board replays a selected line from a copy of the exact SFEN submitted for that search, with captured pieces and start/previous/next controls. Main-game state is never changed by playback. Earlier searched positions are explicitly identified.

The panel now also includes a dedicated analysis session. Select an enabled engine, supported candidate count (1–5), and a search budget (1–60 seconds), then choose **Analyze position**. Each request uses a unique, separate engine process and captures the currently displayed main-board SFEN. It does not submit analysis moves to the game controller. **Stop analysis** also cancels startup; completion, stop, failure, timeouts and panel unmount retire the process and event listeners. **Show game searches** returns to the passive game-search view.

Saved engine options are copied into temporary options; the analysis instance overrides MultiPV where advertised, and uses conservative temporary thread/hash limits (2 threads and 128 MB, bounded by advertised limits). Saved options and playing-engine options are unchanged. Engines that do not advertise MultiPV are limited to one requested candidate. Each request currently starts a fresh process, so large evaluation files may add startup time.

**Pin continuation** snapshots the selected root and line so incoming results cannot reset playback. Choose **Separate Continuation Board** to pin the selected line and open its own view. Playback step and pinned line are shared with Candidate Moves; reattaching preserves both. The embedded board remains the default.

## Retained ideas and required information

### Candidate Moves — implemented first version

Required: root position, engine identity, MultiPV rank, PV moves, score (centipawn or mate), score bounds, search depth. Available through `GamePage` search requests and raw `usi-message::<engineId>` events from the Rust engine manager. `candidateAnalysis.ts` retains mate and bound values that the existing evaluation parser omits. Scores are normalized using the searched side to move, rather than engine/player identity. Each engine's lines are cleared when its next search starts. MultiPV availability depends on advertised engine metadata and actual engine output; a raw transport does not guarantee engine support.

Delivered: dedicated analysis instance, supported MultiPV selector and pinned continuation. Delivered: Japanese move labels alongside USI. Delivered: optional reusable dedicated-analysis engine sessions.

### Continuation Board — implemented first version

Required: root SFEN, ordered USI moves, legal replay, hands. Available through `tsshogi.Position.newBySFEN`, `createMoveByUSI`, `doMove`, and `hand`. Playback stops at an invalid move and uses independent positions. The board can remain embedded or open as its own floating panel/native window without changing the game.

Delivered: pinned lines, optional separate view, synchronized playback/reattachment, Variation Tree, move highlighting, clickable move navigation and an End control. Delivered: Japanese move labels and legal board-based branch entry, including drops and promotion choices.

### Game Review — implemented first version

A separate review panel snapshots the game record and reconstructs every position using legal replay. It sequentially analyzes those positions with one enabled engine, one time budget and saved options captured once for the whole run. Review engines are independent of playing engines. Stop cancels startup/current search and prevents remaining searches; completed results survive cancellation or a later error. The latest completed/partial review is cached locally and restored only for an exactly matching record.

Rows show before/after evaluations normalized to Sente, estimated loss from the mover's perspective, and a filter for losses of at least 150 centipawns. Played moves and engine continuations can be previewed on the separate Continuation Board without navigating the main game. Mate, bounded or missing scores do not produce numeric losses. These are equal-budget adjacent-position estimates: search horizon differences can affect them, and they are not forced-move comparisons or definitive mistake classifications. Delivered: same-root restricted played-move comparisons and selected saved-branch review. Next: richer review navigation.

### Engine Thinking — implemented first version

A separate panel presents optional depth, selective depth, nodes, nodes/second, elapsed time, hash occupancy, current move, score and PV. Metrics arriving without a PV are retained. It shows game searches, dedicated position analysis and the latest review search, with engine identity, completion status and earlier-position labels. It can float or pop into a native window. Delivered: search history. Next: additional advertised engine metrics.

### Variation Tree — implemented first version

The separate Continuation Board now includes an independent Variation Tree. **Save preview line** imports a candidate/review continuation as legal branches, sharing common prefixes. Select any saved node to replay its exact position. At an earlier preview step, enter a USI move and choose **Add from preview position** to create a branch. Different root SFENs remain separate starting positions; no branches are imported into the running game.

**Remove selected branch** removes its descendants, while **Undo tree edit** restores up to 20 recent edits in the current session. The study is saved locally after successful edits, validated on reload, and synchronized through the main window for native pop-outs. Corrupt saved data is retained until the user deliberately replaces it. **Import / export study** downloads or displays versioned JSON; imports validate every move and position before replacing the study. Bounds: 2000 positions, 256 moves per branch and 2 MB imported JSON.

Open **Variation Tree** above Candidate Moves, or separate the Continuation Board. Both open the same board/tree workspace and pin the current preview. To save a different incoming candidate, unpin the continuation and select that candidate before saving. Review previews can also be saved. Enable **Enter variation on board** in the separate Continuation Board, select a piece or a piece in hand, then a highlighted destination. Optional promotion asks for a choice; required promotion is automatic. Each legal move saves and selects a branch at the preview position. Native requests carry the expected root and move prefix; stale requests are rejected. Manual USI entry and JSON study export remain available. Position comments and standard branch-aware KIF export are available. Deliberate import into the main game remains future work.

### Mate Search — implemented first version, engine-dependent

Open **Mate Search** above Candidate Moves. Select an enabled engine and a 1–60 second budget. A fresh independent process searches the captured main-board position using `go mate <milliseconds>`. **Search a custom SFEN** allows puzzle positions without changing the game. Temporary options reuse the dedicated-analysis policy; playing engines and saved options remain unchanged.

The panel separately presents a reported mate, engine-reported no mate, inconclusive timeout, unsupported response, invalid line/error and Stop. Only dedicated `checkmate` replies establish observed mate-protocol support. A normal `bestmove` response is marked incompatible/unsupported for this request, while silence leaves support unverified. Capability labels describe responses observed in the current UI session and do not infer support from metadata, MultiPV or ordinary mate scores.

Reported mate lines are replayed independently: moves must be legal, every attacking move must give check, the last move must belong to the attacking side, and the final defender must have no legal move or drop (including promotion escapes). This validates the principal line, not all alternative defenses in the engine's forced-mate proof. Invalid lines are never offered for preview. A valid line can open in Continuation Board and be saved to Variation Tree. The panel can float/pop out and export the captured root, effective settings, reply and result as JSON.

Stop cancels startup and active searches. A watchdog retires an engine that fails to reply within the budget plus five seconds, without concluding that no mate exists. Process completion, failure and unmount also clean up owned processes/listeners.

### Engine Comparison — implemented first version

Open **Engine Comparison** above Candidate Moves. Select two different enabled configurations, a common candidate count (limited to what both advertise) and a time budget. Both independent processes receive the exact same captured root SFEN and `go movetime` budget. Each engine's saved settings and metadata are snapshotted at startup; temporary settings target 2 threads, 128 MB hash, book disabled and analysis mode where advertised, adjusted to supported limits. Saved/playing-engine settings are not changed. Engine-specific evaluation files and other settings can differ; equal time does not imply equal depth, strength or identical hardware usage.

Results show side-by-side statuses, scores, PVs and search metrics. Sente-normalized score differences exclude bounded, mate or missing scores. First-move agreement describes current engine choices, not correctness. A changed main-board position is explicitly marked as an earlier captured position. **Stop both engines** also cancels startup; one failure preserves the other engine's progress. Continuations open in the separate board and can be saved to Variation Tree. Engine Thinking includes both comparison searches.

The panel can float or pop into its own native window. **Download comparison results and settings** exports versioned JSON containing the captured root, budget, engine identities, effective temporary options and latest results. Automatic result restore and depth/node-budget modes are delivered; see the October 7 comparison update below.

## Source evidence

- `src/components/GamePage.tsx`: game/recommendation requests send exact current SFEN and receive engine messages; first candidate delivery captures roots before `go`.
- `src/utils/tauriEngine.ts`: arbitrary command bridge and existing structured info parser.
- `src-tauri/src/engine_manager.rs`: per-engine raw USI events.
- `src/types/engine.ts`: engine metadata with advertised options, defaults and bounds.
- `src/components/EngineOptionsModal.tsx`: existing engine option UI.
- `src/hooks/useSecondaryWindow.ts`: shared native window synchronization and lifecycle.
- `src/usi/controller.ts`: game records and USI move conversion.
- `src/components/EvaluationGraph.tsx`: existing evaluation history presentation.

## Suggested delivery order

1. Candidate Moves + paired Continuation Board (delivered).
2. Dedicated analysis session, engine-supported MultiPV controls and pinned continuation (delivered first version).
3. Optional detached Continuation Board and Engine Thinking (delivered first version).
4. Game Review (delivered first version), Variation Tree (delivered first version).
5. Engine Comparison (delivered first version), Mate Search (delivered first version; engine-dependent).

## Follow-on delivery order

The seven original analysis views have a first implementation. Remaining work is tracked here so it does not get lost:

1. Continuation move highlighting, clickable navigation and End control — delivered.
2. Japanese move notation in candidate/continuation views, with USI retained for engine commands and study data — delivered.
3. Board-based branch entry with independent study state and promotion/drop legality — delivered. Variation comments — delivered.
4. Standard branch-aware KIF study export — delivered.
5. Game Review forced-move comparisons and selected saved-branch results — delivered.
6. Engine Comparison result restore and depth/node budgets — delivered.
7. Engine Thinking search history and optional reusable dedicated-analysis sessions — delivered.
8. Game Review navigation: step through reviewed moves with best/played continuations and captured-position context — delivered.

Manual native-window verification remains part of each view's acceptance; current automated/live checks do not claim to cover all popped-out controls.

## Verification limits

Automated tests cover structured parsing, score perspective, search reset/update behavior, isolated legal replay and panel interaction. Native pop-out creation and a real engine producing multiple PVs require exercising the Tauri app; a browser-only production build cannot verify those behaviors.



## Engine capability findings and live checks

Saved engine metadata advertises MultiPV for Apery_2.1.0 (and its duplicate configuration) and YaneuraOu NNUE V9.00Git 64APPLEM1 TOURNAMENT. Built-in Engine, Yggdrasil, Yggdrasil - nnue, and Yggdrasil - nnue stable do not advertise MultiPV in their current saved metadata. Metadata may change when engines are refreshed; the UI derives the supported range from each enabled engine's metadata.

A live, isolated check of the actual `AnalysisSession` with a subprocess transport ran one-second, three-candidate searches against the installed Apery and YaneuraOu engines. Both returned ranks 1, 2 and 3 for the requested root, reached completion, and left zero owned processes running. A separate Stop-during-search check also left zero owned processes. This verifies those engine binaries and the session controller; it does not substitute for an end-to-end check of Tauri's event bridge and popped-out controls.

Dedicated mate-search responses were checked on October 5, 2026; findings are below. MultiPV advertising does not imply mate-solver support. Normal search mate scores and dedicated `go mate` results are different capabilities.

References: [YaneuraOu MultiPV explanation](https://yaneuraou.yaneu.com/2022/02/20/multiple-pv-in-shogi-software/) and [USI protocol reference](https://hgm.nubati.net/usi.html).

## Separate Continuation Board and current verification

Detachment is implemented now because captured roots, pinned lines and independent playback are available. Shared state preserves the exact line and playback step across floating/native views and reattachment. The first branch-management view is now available within this separate board; richer board editing remains future work.

45 focused tests pass across sessions, parsing, review orchestration, persistence, panel interaction and shared-window state. The production frontend build and native `cargo check` pass. Live Apery review completed three positions and cancellation left zero owned processes. The subprocess check exercises the actual review/session controllers but does not verify native pop-out UI end to end.

The full suite reports 76 passing tests and the same 13 existing failing tests, plus the missing EngineSettings suite. Strict type checking remains blocked by existing application errors and missing Testing Library DOM types, including the window test’s waitFor import. The worktree also lacks a direct installed Testing Library DOM dependency; tests were run using the main checkout's dependency through NODE_PATH. ESLint has no matching TypeScript configuration.

Use **Engine Thinking** and **Game Review** above Candidate Moves to open those panels; use **Separate Continuation Board** within Candidate Moves after selecting a line. Review previews also open the separate board. Native window capability changes require a fresh native application launch.

## Variation Tree verification — October 5, 2026

Regression tests cover common-prefix merging, distinct roots, atomic rejection of illegal lines, subtree removal, validated JSON round-trip, forged positions/duplicate IDs/invalid selections, candidate-to-tree navigation, local restore, native actions, undo, corrupt-cache preservation and import/export. The study uses independent positions and makes no engine or game-controller commands. Native pop-out UI still needs manual end-to-end testing; no additional Rust capability or engine support is required for this increment.

Final checks for this increment: all 55 focused analysis tests pass; the production frontend build passes. The full suite has 86 passing tests, the same 13 failing tests and missing EngineSettings suite. Strict type checking still fails on existing application issues and missing Testing Library DOM declarations (including fireEvent in the expanded host regression test); no new production Variation Tree file has a type diagnostic.

## Engine Comparison verification — October 5, 2026

User reports that Variation Tree works in the running app. Comparison regression coverage includes unique process ownership, same-root/equal-budget commands, temporary option snapshots, stop during startup and active searches, one-sided failures, fresh runs, disposal, score perspective, unsupported budgets, result export, native action routing and continuation-to-study preview. Live installed Apery and YaneuraOu each returned three candidate ranks on the same root with a one-second budget; completion and Stop left zero owned engine processes. Native capability compilation passes. The live subprocess check does not replace manual testing of the comparison pop-out controls.

Final Engine Comparison checks: all 66 focused analysis tests, the production frontend build and native cargo check pass. The full suite reports 97 passing tests and the same 13 existing failures plus the missing EngineSettings suite. Strict type checking remains blocked by existing application and Testing Library dependency/type issues; no new comparison production file has a diagnostic.

Manual comparison check: open Engine Comparison, choose Apery and YaneuraOu, request three candidates for five seconds, and confirm both finish. Preview one line and save it to Variation Tree. Start a longer comparison and Stop both engines; then exercise the comparison pop-out. Native capability changes need the rebuilt development app.

## Mate Search verification — October 5, 2026

All seven enabled installed engine configurations were tested through the production MateSearchSession with a subprocess transport on a known one-move puzzle and a one-second budget:

- Apery_2.1.0 and its duplicate: `checkmate G*5b`; the line passed legal/check/final-mate validation.
- Built-in Engine, YaneuraOu NNUE V9.00Git 64APPLEM1 TOURNAMENT, Yggdrasil - nnue and Yggdrasil - nnue stable: normal `bestmove` replies instead of a dedicated mate reply; this installed build/configuration did not provide the mate protocol on this test.
- Yggdrasil: no dedicated reply within the watchdog interval; support remains unverified, not disproven.

Every probe retired its owned process. A separate live Apery Stop test ended as stopped with zero owned processes. These findings apply to the tested binaries/configurations; engine names or other builds do not guarantee the same behavior. The in-app capability labels are learned from actual in-app requests rather than hardcoded from this document.

All 84 focused analysis tests, frontend production build and native capability checks pass. The full suite has 115 passing tests, the same 13 existing failing tests and missing EngineSettings suite. Strict type checking remains blocked by existing application and Testing Library dependency/type issues, including fireEvent in the new panel test; no new production Mate Search file has a type diagnostic. Native pop-out interaction still needs manual verification.

### Manual mate check

1. Open Mate Search and choose Apery_2.1.0.
2. Expand Search a custom SFEN and paste `4k4/9/4G4/9/9/9/9/9/4K4 b G 1`.
3. Choose one or five seconds and Search custom position. Expect a validated one-ply mate, `G*5b`.
4. Preview mate line, advance to its last move and save it to Variation Tree. The main board must remain unchanged.
5. Check Stop mate search on a longer request, and exercise the mate panel's native pop-out.
6. Try YaneuraOu or another installed configuration to verify its incompatible/unsupported response is distinct from no mate.

Protocol reference: [USI go mate and checkmate replies](https://hgm.nubati.net/usi.html).

## Continuation navigation verification — October 5, 2026

The shared Continuation Board now offers clickable numbered USI moves, a starting-position link and an End button. The current preview move is indicated in the list; Board receives the last successfully replayed move for source/destination highlighting. Drops have destination-only highlighting. The same component serves embedded and native/detached views, preserving the main-owned playback step. Illegal suffixes are disabled, and End lands on the last valid position; users can always navigate back.

All 27 focused parser/continuation/candidate/host tests pass. The production frontend build passes. The full suite has 119 passing tests, the same 13 existing failures and missing EngineSettings suite. Strict type checking retains existing failures with no new continuation production diagnostic. Regression coverage includes direct jumps, End/Start, current-move indication, drops/promotions, illegal suffixes, line changes and unchanged main state.

Manual check: open any continuation, click a numbered move, use End then Starting position, and confirm highlights follow the preview. Repeat in the separate/native view and reattach; the main game's board must stay unchanged.

## Japanese notation and board entry — October 5, 2026

Candidate and continuation labels use tsshogi notation against each preceding replay position; USI remains visible and is retained in saved studies. Unknown or illegal suffixes retain their original USI labels. Board entry is opt-in in the separate floating/native continuation workspace, supports legal destinations, drops, optional/forced promotion, and saves each move as a branch. Main-owned validation rejects stale native requests and illegal moves without changing the game record.

Six added regression cases pass. The frontend build passes; full suite: 125 passing tests and the same 13 existing failures plus the unavailable EngineSettings suite. Strict type checking still has baseline errors, with no new production diagnostics in changed analysis components. Manual check: open Variation Tree, enable Enter variation on board, play a move, return to an earlier move and create a sibling branch; test a drop and both promotion choices, then reopen the saved tree. Repeat in a native window and confirm the game board never changes.

## Variation comments and KIF export — October 6, 2026

Select a saved Variation Tree node, enter **Selected position comment**, and choose **Save comment**. Notes belong to the selected saved position (including starting positions), rather than an unsaved preview step. Nodes with notes show a pencil marker. Comments persist with the study, round-trip through JSON, synchronize through main-owned native actions, and participate in **Undo tree edit**. Empty comments remove the note; existing version-one studies without comments remain compatible. Save a draft before changing the selected node. Comments are limited to 10,000 characters and total study data remains within the 2 MB reload/import limit.

Open **Import / export study**, then **Prepare KIF for starting position N** and **Download KIF**. Each independent root needs its own KIF file, containing its exact initial board/hands/side, all branches and saved multiline comments. Files use UTF-8. KIF creation validates the study before using tsshogi's standard record exporter; it does not change the study or main game. KIF import into the study and deliberate main-game import are not part of this delivery.

Regression tests reimport emitted KIF and verify sibling paths, custom roots, drops, promotions and Japanese/multiline comments. UI tests cover editing, selecting nodes, download content, native comment persistence and undo. Native pop-out interaction and opening downloads in external Shogi applications still need manual verification. Next recommended work: Game Review forced-move comparisons and branch-aware results.

Verification: all 22 focused study/KIF/host/UI tests pass; production frontend build passes. Full suite: 130 passing tests, the same 13 existing failures, and the unavailable EngineSettings suite. Strict type checking retains baseline errors, with no diagnostic in the changed production study/host components.

## Secondary View menu — October 6, 2026

The row of analysis launch buttons and minimized Candidate Moves launcher have moved to the existing game controls/menu under **View**. Compact layout uses **Menu → View**; classic layout includes View alongside the existing game controls. There is no separate fixed View control. Choices open or bring forward existing panels; they do not toggle a running analysis closed. Native windows are shown and focused. Floating panels can be raised through the menu or by clicking them. Escape returns focus to View; outside clicks and selections dismiss the menu. Normal Tab navigation is available. USI Monitor and Evaluation entries are disabled where their native game hosts are unavailable.

Main-window shortcuts are **Command+Option+1–8** on Mac or **Ctrl+Alt+1–8** on Windows/Linux, in this order: Candidate Moves, Continuation Board / Variation Tree, Mate Search, Engine Comparison, Engine Thinking, Game Review, USI Monitor, Evaluation. Labels display the platform shortcut; modifier combinations and physical digit keys work even when Option changes the typed character. Repeated keydown events are ignored. Shortcuts require the main game window to have focus. Existing panel header controls still close, dock or pop out views.

Manual check: overlap several floating panels, then open each through View or its shortcut. Confirm the requested panel comes forward, Candidate Moves reopens after minimization, and a repeated command does not interrupt an active analysis. Repeat with an existing native pop-out to verify show/focus.

Menu correction: View now opens the window choices directly. Compact-menu choices use a side flyout rendered outside the parent menu’s overflow clipping, placed to fit the viewport. Arrow keys, Home/End and Escape navigate/dismiss the submenu; shortcuts remain unchanged.

## Menu icons and game shortcuts — October 6, 2026

View and every secondary-window item now have icons matching the existing menu style. Existing game actions display platform shortcuts and expose aria-keyshortcuts. Mac uses Command; Windows/Linux use Control. New Game: modifier+N; Save Game: modifier+S; Load Game: modifier+O; Settings: modifier+comma; Exit to home: modifier+Shift+H; Export GIF: modifier+Shift+E; Hints: modifier+Shift+R (human-player games only); Pieces: modifier+Shift+P; Board: modifier+Shift+B. Secondary view shortcuts remain modifier+Alt+1–8. These operate in the main game window, including when its compact menu is closed. Game action shortcuts defer to active dialogs and ignore repeated/composing events and unrelated modifier combinations.

## Movable compact game workspace — October 6, 2026

The compact layout's board, both captured-piece trays, move history and existing right-side menu/clocks move together without added chrome, resizing, minimization or native pop-out. Drag from the board's top number strip, either tray heading or Move History. Board squares, pieces, hand selections and menu controls remain ordinary game interactions. Heading drags use pointer capture and a five-pixel threshold; CSS zoom is accounted for. Position is saved locally and restored. The board heading remains partly reachable when dragged off-screen or after a resize. Double-click any drag heading to restore the normal position. Compact is now the only supported game layout.

Manual check: drag the workspace left/right and down, arrange floating analysis panels around it, play a board move and a drop, open View, reload to check placement, resize the viewport, and double-click a heading to reset. The group has no independent window lifecycle or decorations.

Compact-only layout correction: Slim rendering and layout selection were removed from both game and home settings; cached old layout choices are ignored. Heading reset detects two pointer clicks directly, including when pointer capture suppresses the native double-click event. Menu toggle shortcut: Command+Shift+M on Mac, Ctrl+Shift+M on Windows/Linux.

## Direct and saved-branch review — October 6, 2026

New Game Review runs search each move twice from its exact preceding position: an unrestricted best-line search, then `go movetime ... searchmoves <played move>`. Both use one engine configuration, a saved-option snapshot and equal per-search time. Sente-normalized scores are compared in the mover's direction; bounded, mate or missing scores produce no numeric loss. Negative differences from search noise are clamped to zero. These are estimates, not definitive mistake labels. Engines must honor the restricted command: a different bestmove produces an error; a mismatched reported PV is rejected. Cancellation or failure preserves completed pairs, never counting an incomplete pair as a reviewed move. Two searches per move increase total search time; each still owns and cleans up a separate engine process.

Use **Review scope → Selected saved branch** to review the path from a study root to its selected node. Different roots and custom SFENs are supported through legal replay. The main host resolves native scope requests against its authoritative current tree; views cannot supply a forged branch record. A running review captures the path, so later game/tree edits do not change it. Best and restricted played continuations can open in the shared board/tree workspace without changing the game. Old cached adjacent-position reviews remain readable and are labeled as the earlier method. The cache still retains only the latest review and auto-restores only for the matching current game; branch reviews remain available during the session.

Manual check: review a short game, verify two searches per move, preview both lines, then select a saved tree node and review that branch. Confirm its rows correspond to the branch rather than the game. Stop during a restricted search, repeat through the native review window, and confirm completed rows survive and the game stays unchanged. Richer navigation and review histories remain follow-on improvements.

Verification: all 37 focused review/session/cache/UI/host tests and the production build pass. The isolated installed Apery probe reached restricted searching but did not return bestmove within 20 seconds; forced-search compatibility is unverified and requires an in-app check. Every probe process was terminated. This is distinct from the earlier ordinary review and mate-protocol checks. No native review-window end-to-end claim is made.

## Proportional workspace resizing — October 7, 2026

Drag any outer corner region of the compact playing group to scale the board, hands, history, menu and clocks together. Hit regions have no visible chrome; hover shows a diagonal resize cursor. Resizing projects pointer motion onto the corner's diagonal, preserving one uniform scale and holding the opposite corner fixed. Scale is limited to 50–150% of the normal responsive size, with additional bounds that keep part of the board heading reachable. Responsive CSS zoom is accounted for. Size and position are persisted separately; existing position-only storage remains compatible.

Double-click a corner to reset size only. Double-click a heading continues to reset position only. Pointer-click detection supports reset even when native double-click is suppressed by pointer capture. Corner regions also accept keyboard focus: arrows change proportional size, Home resets it; focus indicators appear only during keyboard use. Piece moves, drops and menu controls are unaffected outside the small corner regions.

Manual check: drag each corner, confirm proportions and opposite-corner anchoring, move the scaled group by a heading, then reset size and position separately. Test at a responsive viewport width, reload to confirm persistence, and open View after scaling. No minimize, pop-out, independent-axis resizing or visible handles were added.

## Shared secondary-window transparency — October 7, 2026

**Settings → Display → Secondary window transparency** controls all docked/floating analysis panels and native pop-out content. The range is 0–60% transparency; default 0% is fully opaque. Text, controls and backgrounds fade together once at the outer panel, avoiding compounded opacity in nested tables. **Restore opaque windows** resets the preference. Board workspace, game menu and Settings itself stay opaque. Settings persist locally, notify same-page consumers immediately, and update other webviews via storage events.

Native secondary windows are created with transparent webview/window backgrounds; only secondary routes clear HTML/body/root canvas backgrounds. Native title bars remain managed by the operating system. A fresh native app launch and reopening existing pop-outs are required for the transparent creation/config changes. macOS transparency enables Tauri's macos-private-api feature and app.macOSPrivateApi configuration; this mode is not compatible with Mac App Store distribution. Default fully opaque panel content remains available with transparency at zero.

All 9 focused settings/preference/window tests and the production frontend build pass. Native cargo check passes with the installed macOS 14.4 SDK. Full-suite and strict type-check baseline failures remain. Native visual/compositor transparency still needs manual verification after restarting; storage-event tests do not constitute a live multi-window visual check. Manual check: overlap two floating panels, adjust the slider and confirm both fade live; reset to zero, reopen Settings, then repeat with freshly created native windows.

## Shared workspace stacking — October 7, 2026

The game board group now participates in the same in-app stacking order as secondary panels. Click any exposed area of the game workspace to raise the whole group; click an exposed secondary panel to raise it above the group. Raising one preserves the relative order of the others. Pointer capture on the group observes clicks even when child controls stop propagation, without preventing normal game interactions. Dragging, resizing, saved placement and transparency are unchanged. Menu flyouts and modal dialogs retain their higher layers. Native windows continue to use operating-system stacking.

Manual check: overlap two floating analysis panels with the board group. Click the exposed board/tray/history/control to raise the game, then click an exposed area of each panel to raise it. Confirm pieces and controls still respond, heading drags and corner resizes work, and other windows retain their relative stacking order. No setting is needed.

## Consistent secondary-window controls — October 7, 2026

Every secondary panel now uses one shared icon/control component and ordering: dock/return, pop out, hide/close. In-app floating panels offer **Dock in original location**, **Pop out window**, and **Hide panel (reopen through View)**. Docked panels offer pop out and hide. Native panels offer **Return to main window** and **Close window (reopen through View)**. Tooltips and accessible names describe every control. No hidden or popped-out panel produces a replacement launcher button, including the legacy USI/Evaluation views.

Native Return is a distinct close notification carrying redock intent. The main host restores visibility and clears its floating placement mode so the panel returns to its original dock. Ordinary native close dismisses it. Returning/closing callbacks are kept current without reinitializing native discovery, avoiding races that could mark a just-returned window as popped out again. Main-window panel components stay mounted behind hidden sections, preserving in-app form state and USI history; main-owned analysis/review/comparison/mate sessions and structured results continue while their views are hidden. Closing a native view never retires those main-owned sessions. Native views continue to synchronize structured results with the main host.

View and shortcuts remain the only launchers. Legacy USI/Evaluation routing is owned by GamePage, so those entries remain available independently of dedicated-analysis panels (including the browser USI fallback). Manual check each panel: float and dock it, pop out, return to main, pop out and close, then reopen from View/shortcut. Confirm no launcher appears, tooltips explain each action, native return goes to the dock, in-app search controls survive hide/reopen, and active analyses continue. Native return interaction still requires manual end-to-end verification.


## Color palette previews — October 7, 2026

Settings → Appearance → Color Theme now offers a responsive grid of miniature interface previews, replacing the long text-only list. Each card shows the actual palette's panel, card, text, accent and action colors, plus its name and description. New palettes are Washi Paper (ivory/vermilion), Jade Mist (pale jade/teal), Indigo Ink (dark blue/periwinkle), Copper Night (warm charcoal/copper), and Plum Silk (lavender/plum). Existing palettes and Dynamic remain available. The selected card shows a check and outline; clicking anywhere on the card applies and saves the selection immediately. Native radio keyboard navigation supports Tab and arrow keys. Board and piece artwork remain separately selected. Dynamic's card uses its dark fallback palette.

Verification: 24 focused tests pass, including restoration of each new palette and complete palette tokens with at least 4.5:1 contrast for primary, secondary, muted and accent text on panel backgrounds and primary button labels. Browser inspection confirmed the preview layout, whole-card selection, and arrow-key selection. Production build passes. Full suite: 174 passing tests, the same 13 existing failing tests and missing EngineSettings suite; strict type checking remains blocked by existing errors and missing Testing Library DOM declarations.


## Comparison restoration and search budgets — October 7, 2026

Engine Comparison now offers **Search budget → Time / Depth / Nodes**. Time retains the 1–60 second choices; depth accepts 1–100 plies; nodes accepts 1–1,000,000,000. Both independent engines receive the identical root SFEN, candidate count and budget command (`go movetime`, `go depth`, or `go nodes`). Budget values and saved options are frozen for the run. Equal depth is not equal strength, and different engines can count nodes differently. These commands follow the [USI protocol](https://hgm.nubati.net/usi.html). Depth/node searches have a fixed 60-second watchdog from search start; exceeding it retires the process, marks that side as an error and retains its partial results. A finished engine is never restarted when its partner fails. Actual reported depth/nodes/time remain visible.

The latest finished or stopped comparison is cached locally, including its root, engine identities, effective settings, selected budget and results. Reopening/relaunching restores data only, labeled **Saved comparison restored**; nothing starts until **Compare position** is pressed. Different current positions are labeled **Earlier captured position**, and preview playback uses the saved root. Older time-only comparison data remains readable. Validation checks version, bounded payload/field sizes, terminal statuses, both roots, metrics, ranks, budgets, settings and legal replay of each continuation. Invalid cache content is ignored and retained until a valid new finished result replaces it. Storage failures do not interrupt searches. JSON downloads now include the selected budget. The cache keeps the latest comparison only.

Live production-controller tests with installed Apery_2.1.0 and YaneuraOu NNUE V9.00Git 64APPLEM1 TOURNAMENT completed at depth 4 and at 100,000 requested nodes. Depth reports were both 4; node reports were 100,110 and 100,045, respectively, so node limits are approximate. Both used the same root and left zero owned processes running. Other installed engines' depth/node support remains unverified; the panel does not infer it from MultiPV metadata.

Regression checks cover identical budget commands, invalid values, a 60-second timeout retaining partial results, cached results without automatic engine startup, a fresh explicit run after restoration, backward compatibility, invalid/corrupt cache preservation, UI controls/status labels and native action routing. All 61 focused checks pass. Full suite: 194 passing tests with the same 13 existing failures and missing EngineSettings suite. Strict type checking still has existing application and Testing Library declaration errors. The frontend production build passes. Browser-only GamePage disables dedicated analysis views without Tauri, so native menu/pop-out interaction still needs manual verification. Next recommended roadmap item: **Engine Thinking search history**.

Manual check in the native app: open View → Engine Comparison, compare two engines at depth 4 and 100,000 nodes, inspect each side's metrics, and preview a candidate. Close/reopen the app and confirm the saved comparison returns with its original budget without spawning engines. Change the board position and confirm the earlier-position label and saved-root preview. Repeat controls in a popped-out comparison window; Stop should retire both running engines and retain partial data.


## Engine Thinking search history — October 7, 2026

Open **View → Engine Thinking → Search history** to revisit the latest 100 finished searches in this app session. The saved-search selector labels each search by start time, source (Game, Dedicated Analysis, Game Review or Engine Comparison), engine, outcome, reported depth and position move number. Details retain reported depth, selective depth, nodes, NPS, elapsed engine time, hash occupancy, current move, candidate scores/lines and the captured root SFEN. Missing metrics remain explicitly unavailable. Stopped, failed and replaced searches are labeled separately from normal completion. Wall-clock start/finish timestamps describe when the frontend observed the search, rather than engine timing.

**Live searches** shows the current game searches alongside dedicated analysis, review and comparison searches. **Preview candidate** opens the selected historical line on the shared Continuation Board, pinned to its original root, without navigating or changing the main game. The main host resolves native preview requests using its own saved search ID/rank; secondary windows cannot substitute a root or moves. A selected historical search stays selected as new results arrive until that entry is cleared or evicted. **Clear finished history** removes finished entries while active searches keep running and can later enter history.

History capture happens in the game-message and analysis/review/comparison publication paths before React batches updates, so rapid same-root best/played review searches remain separate and final snapshots are retained. Game searches carry distinct search IDs even when a playing process searches the same root again. Snapshots copy metrics and candidate arrays, and cap lines to five with 256 moves each. Finished history is bounded at 100 entries while active searches are protected. The main window owns history and synchronizes it into the popped-out Thinking view; recording does not depend on panel visibility. History stays in memory for this app session; relaunching starts fresh apart from the latest comparison restored by its existing cache. Dedicated mate searches use a separate protocol and are not mixed into this ordinary-search history.

Regression checks cover independent same-position runs, metric-only searches, copied snapshots, retention/clear behavior, interrupted runs, stable selection, candidate preview routing from a hidden panel/native action, and dedicated/review publishers with rapid batched transitions. Production build passes. Full suite: 206 passing tests, with the same 13 existing failures and missing EngineSettings suite. Strict type checking remains blocked by existing application and Testing Library declaration errors. A browser fixture verified the styled history layout and selecting a stopped search; the temporary fixture was removed afterward. Actual native pop-out interaction still needs manual verification.

Manual check: complete two dedicated analyses, then open Engine Thinking and select each under Search history. Run Game Review and confirm both best/played jobs appear independently at each root. Start a long comparison, clear finished history while one or both sides are running, then stop and confirm partial metrics are retained. Preview an earlier candidate and confirm the main board is unchanged. Repeat selection, Clear and Preview from the popped-out Thinking window. Next recommended roadmap item: optional reusable analysis sessions with clean restart/options and position isolation.


## Optional reusable dedicated analysis — October 7, 2026

Candidate Moves now offers **Keep analysis engine ready between searches**, off by default and persisted locally. When enabled, a completed dedicated analysis keeps its independently owned engine idle for up to two minutes. The next analysis reuses that process only if engine identity/path/metadata, saved options and effective temporary options all match. Changing engine, saved settings or candidate count retires it and starts a fresh process. Time budget and root position may change without restarting. The panel identifies reused searches and reports when the engine is ready; **Close analysis engine** releases it immediately. **Show game searches**, disabling reuse, Stop, failures, session teardown and idle expiry also release owned resources. Hiding/popping out the panel follows the existing main-host lifecycle and does not itself close a ready engine.

Each request retains its own unique search identity and fresh candidate/metric state even when the physical process is reused, preserving Engine Thinking history. Reused runs send `usinewgame`, invoke an advertised Clear Hash button if available, then wait for `readyok` after `isready` before sending the exact captured root and search command. This readiness barrier follows the [USI protocol](https://hgm.nubati.net/usi.html). Idle and pre-ready packets never enter the new search. Missing readiness replies time out after five seconds and retire the process. Stop cancels readiness/startup as well as active searching. Engines determine how much internal state `usinewgame` clears; a warm run is not a promise of identical results to a fresh process. Fresh mode remains available. Playing engines are never reused, and Game Review/Engine Comparison retain their separate fresh-process policy for comparable settings/budgets.

Live tests with Apery_2.1.0 and YaneuraOu NNUE V9.00Git 64APPLEM1 TOURNAMENT completed one-second searches on two roots using the same physical PID and separate search IDs. Increasing the candidate count restarted each engine and returned two candidate ranks; stopping a later reused search left zero owned processes. Automated regression coverage includes matching-settings reuse, candidate/saved-option/path/metadata changes, clean metrics/root state, pre-ready packet filtering, cancellation during readiness/options/configuration retirement, readiness/search timeouts, idle process death, two-minute expiry, explicit release/clear/disposal, cleanup retry ownership, persistent controls and native action routing. Frontend production build passes. Full suite: 226 passing tests, the same 13 existing failures and missing EngineSettings suite. Strict type checking retains existing application and Testing Library declaration failures; changed production modules introduce no new errors. Native checkbox/release interaction still needs manual end-to-end verification.

Manual check: enable reuse in Candidate Moves, analyze, and confirm the ready message. Change the main position and analyze again; confirm the reused message and distinct history entries. Change candidates or engine settings and confirm a fresh run. Exercise Close, Show game searches, Stop during startup/search, and two minutes idle; verify owned analysis processes retire. Repeat enable/disable and Close in the popped-out Candidate Moves window. Next recommended roadmap item: richer **Game Review navigation**.


## Game Review navigation (delivered)

Game Review now offers First, Previous, Next and Last controls plus direct reviewed-move selection. Selecting a move opens its pinned continuation in Continuation Board from the captured position before that move. Played/best continuation buttons choose which line is used by subsequent navigation; a move without a best line falls back to its played continuation. The main game remains unchanged. Existing per-row preview buttons also update the navigation selection.

The flagged-moves filter limits navigation to matching reviewed moves. The selected row is highlighted; captured starting SFEN is available in a disclosure. With a navigation button focused, Left/Right and Home/End navigate; native select controls retain their usual keyboard behavior. New streamed results do not automatically open or replace a preview. Review identity prevents selections from being carried into a different game/settings snapshot, and main-window handling rejects stale popped-out preview requests by snapshot and captured root.

Validation: 38 focused checks pass across review UI, runner, hook and host integration. Full suite: 231 passed, 13 existing failures, plus the existing missing EngineSettings suite (4 failed files). Production build passes; strict type checking still reports existing application/test dependency errors, with no errors in changed production modules. A temporary browser fixture verified best-line switching, next-move captured board context and filtered navigation; fixture and tab were removed. Native popped-out end-to-end verification remains manual.

Manual check: review a game or saved branch with several moves. Select Show best continuation and step forward/back, then select Show played continuation. Confirm Continuation Board identifies the correct review move, starts before that move, and its playback follows the chosen line without changing the main board/history. Enable the 150 cp filter and confirm navigation skips other rows. Advance the main game and verify the earlier-snapshot notice and old captured previews remain valid. Repeat navigation in popped-out Game Review and Continuation Board, including returning/hiding/reopening both windows.

All eight follow-on items now have implementations. Recommended next work is a native acceptance pass across the analysis windows, especially review/continuation routing, pop-out lifecycle and review of saved branches.


## Responsive Evaluation window

The evaluation plot now measures its available container with ResizeObserver and redraws the SVG for both width and height. The graph fills remaining window space instead of keeping a 210 px minimum chart height tied to viewport height. Text stays readable, compact charts use fewer tick labels, and the empty-state message wraps. Window controls, latest score and interpretation headline remain visible; the longer interpretation is available through Evaluation details, with scrolling inside the details area when needed.

Docked Evaluation defaults to 320 px tall. The native window defaults to 560 × 320 with a 360 × 256 minimum (allowing for the native page's 8 px padding). The shared in-app minimum remains 360 × 240. Existing saved bounds continue to apply.

Validation: 20 focused graph/frame/control tests pass. Browser dragging resized an in-app test panel from 360 × 240 to 730 × 440 and back; its actual SVG dimensions changed from 338 × 97 to 708 × 297, and compact details expansion retained an 80 px plot. Observer cleanup and hidden zero-size observations are covered. Build passes; full suite has 239 passing tests with the same 13 pre-existing failures plus the existing missing EngineSettings suite. Changed production Evaluation modules have no TypeScript errors; global baseline errors remain. Native OS window resizing remains a manual check.

### Piece theme selection — October 7, 2026

Settings → Appearance → Piece Themes now retains the complete selected preview above a searchable card gallery. Cards show king, pawn, and promoted pawn from the actual theme, with names, descriptions, style labels, a selected border/checkmark, and native radio keyboard navigation. Search matches names/descriptions; Japanese, International, Illustrated, and Other filters combine with search without changing the selected setting. Dynamic theme discovery still refreshes on window focus/visibility. The full preview retains all promotion pairs, both SVG kings, and attribution/license links, with theme-aware text contrast and responsive columns. Late metadata from an earlier selection cannot replace the current description.

Validation: eight focused tests pass; browser verification confirmed selection updates, arrow-key navigation, combined filtering, and actual piece asset rendering. Frontend build passes. Full suite: 243 passed and the same 13 pre-existing failures plus missing EngineSettings suite; strict type checking retains existing errors including incomplete Testing Library DOM typings. Manual native check: open Appearance, select a card, confirm board/captured pieces update, close/reopen Settings, and confirm the selection remains.

## Study branch to main game — October 7, 2026

Continuation Board / Variation Tree now offers **Load selected branch as game…**. The selected node's ancestry supplies the starting SFEN, moves and position comments; descendants and other branches remain in the study. A review dialog shows the move list and positions, offers a JSON backup of the current game, and requires explicit replacement. Cancel leaves the main game untouched. Main-window validation rejects illegal paths, inconsistent saved positions and stale native requests before changing the record.

Replacement retires playing/recommendation engines, pauses their message handlers, resets both players to human with hints off and fresh 30-minute clocks, and opens the selected final position for continued play. Independent analysis engines remain separate. Failed engine shutdown retains the current record and offers retry. A session generation guard prevents delayed startup/search callbacks from overwriting the imported game; engines spawned by an obsolete startup are retired. JSON backups now include and restore position comments.

The previous test/type baseline has been repaired: missing Testing Library DOM declarations, obsolete component tests, incorrect CSA promotion parsing, and production TypeScript defects including image palette resolution. Strict type checking and frontend production build pass. The full suite passes with two workers (283 tests, 50 files), avoiding desktop worker oversubscription while native engines are running.

Native acceptance details and remaining checks are recorded in [analysis-native-acceptance.md](testing/analysis-native-acceptance.md). Next useful acceptance work is OS-level Evaluation resizing and extended engine comparison/mate/reuse runs; their existing automated coverage remains in place.

## Secondary window shortcut toggles — October 8, 2026

The eight existing Ctrl+Alt+1…8 shortcuts (Command+Option on macOS) now open a hidden secondary window and dismiss an already-open one. In-app panels hide; popped-out native windows hide without redocking, destroying the window or creating launcher buttons. The next press restores the same native window or in-app panel with its last size, position and analysis data retained. Reopening raises the panel above other surfaces. View menu selections continue to open/focus rather than toggle.

Shortcut input from any popped-out secondary window is forwarded to the main window, which owns the visibility and native lifecycle. Native hide/show failure records an error; repeated toggle requests during a pending native operation are ignored. Hiding retains ongoing analysis ownership and does not start or stop an engine search.

Automated coverage exercises all five auxiliary panels through open/hide/reopen, docked and native hide/show restoration, native shortcut forwarding, and unchanged idempotent menu opening. Manual native check: use a shortcut twice in the main window, reopen and pop out, then press that shortcut while the popped-out window has focus. Confirm the window hides, no launcher appears, and another shortcut press in the main window restores it in place with the same dimensions and data.

The resize observer now ignores zero-sized hidden measurements and queued notifications from disconnected observers. These previously replaced saved floating dimensions with the minimum panel size during dismissal. Regression coverage verifies geometry through hiding/reopening and that deliberate resizing still updates saved dimensions. The native hide permission is enabled for the existing secondary windows.

## Move History ordering and following — October 9, 2026

Move History defaults to chronological rows and scrolls its own container to the latest row when moves arrive, including the second move in an existing Sente/Gote pair. The header's Oldest first / Newest first toggle reverses the rows without renumbering them or swapping player columns. Newest-first mode returns the container to the top for each new move. The order choice is local to the mounted Move History view; a fresh view defaults to chronological order.

The table now has a single scrolling container and sticky player headers instead of a second independently scrolling tbody. Only the history container scrolls; the playing surface and floating panels are not scrolled by this behavior. Users can scroll through earlier moves between updates. Initial START entries are filtered, and Gote-starting records retain the blank initial Sente cell.

Focused tests cover automatic following on both halves of a row, newest-first additions, switching back, preserved numbering/player columns and Gote-start records. Browser verification with the real component and compact styling showed move 55 at the bottom of ascending history and the top of descending history after an explicit add action.
