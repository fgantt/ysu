# Yggdrasil Shogi

Yggdrasil Shogi is a desktop application for playing, learning, and studying Japanese chess. Play a local opponent, challenge a USI engine, watch two engines compete, or explore positions with candidate lines, variation trees, mate search, engine comparison, and game review.

The application uses a React/TypeScript interface and a Tauri 2/Rust desktop backend. This repository contains the game interface and engine integration; the engine executables and their evaluation data are supplied separately. Some native configuration names and executable filenames still use the earlier **Shogi Vibe** name.

![Yggdrasil Night, one of the included wallpapers](output/imagegen/yggdrasil-night-natural.png)

## Start playing

1. Launch the desktop application. To run from source, follow [Development](#development).
2. For engine play, open **Engines** from Home, add a compatible USI engine executable, and wait for validation. Make sure any evaluation files required by that engine are installed according to its documentation.
3. Choose **Start New Game**. Set each side independently to **Human** or **AI**, choose an engine for each AI, and optionally adjust its options for this game.
4. Set the minutes per side and byoyomi allowance. Leave the initial position at **Standard**, choose a handicap preset, or enter a custom SFEN.
5. Start the game. Click a piece and then a highlighted destination, or drag a board piece to its destination. Select a captured piece from your hand to drop it onto a legal empty square.

Human versus human is local play on one computer. Human versus AI works from either side, and AI versus AI supports separate engine configurations, including two instances of the same executable. Only the side to move receives a playing search; optional hints use the human side's recommendation engine.

### Turns, promotion, and clocks

- In a standard game, **Sente / Black** moves first and **Gote / White** moves second. In the supplied handicap positions, White, the stronger side with pieces removed, moves first. Custom positions follow the turn encoded in their SFEN.
- Captured pieces become pieces in hand and may be dropped back onto the board, unpromoted, on a legal turn. Legal destinations are highlighted when you select a piece.
- The promotion zone is the farthest three ranks. Eligible moves into, within, or out of that zone offer promotion. Promotion is mandatory when a pawn, lance, or knight would otherwise have no future move. Rooks become dragons, bishops become horses, and pawns, lances, knights, and silvers gain gold-general movement.
- **Byoyomi** is a fresh per-move allowance after the main clock expires. The indicator beside a clock shows whose turn it is.
- The application checks legal moves and handles check, checkmate/no legal moves, timeout, repetition, and impasse outcomes. Engine-specific behavior and competition-specific rule variations should be checked before using it for formal adjudication.

### A short piece guide

Movement is relative to the direction a piece points; captured pieces change sides when dropped.

- **King:** one square in any direction.
- **Gold:** one square forward, diagonally forward, sideways, or directly backward.
- **Silver:** one square forward or diagonally in either direction.
- **Knight:** jumps two squares forward and one sideways; it can jump over pieces.
- **Lance:** slides any distance forward.
- **Pawn:** one square forward and captures the same way it moves.
- **Rook:** slides along ranks and files; promotion adds one-square diagonal moves.
- **Bishop:** slides diagonally; promotion adds one-square horizontal and vertical moves.

Sliding pieces cannot pass through occupied squares. The **Help** page includes piece diagrams, rules, Japanese notation explanations, and instructions for the application's tools.

## Play and learning aids

- **Hints:** toggle **Show Hints** for engine recommendations on a human turn. Arrows show moves, a highlighted hand piece and destination show drops, and a plus marks promotion. Hints do not play the move for you. Choose a recommendation engine and options in Settings.
- **Engine thinking:** optionally display the current candidate on the game board while an engine searches. Candidates may change before the engine selects its move.
- **Piece tooltips and attacked-piece indicators:** enable or disable these in Settings to suit your familiarity with the pieces.
- **Move history:** view played moves in English, KIF, USI, or CSA notation.
- **Practice:** Name Identification, Movement Pattern Recognition, and Promotion Matching provide randomized recognition exercises, including promoted pieces, with feedback and scores.

## Analysis and study workspace

Open tools through the game's **View** menu. Panels can be moved and resized; supported panels can be popped out into native windows and returned to the main workspace. The game workspace itself can be dragged by its headings and resized proportionally from its corners. Double-click a heading to reset position or a corner to reset size. Secondary-window transparency is adjustable in Settings, with a control to restore opaque windows.

Analysis previews use captured positions and leave the main game unchanged. Starting a separate analysis, comparison, review, or mate search can deliberately run additional engine processes alongside a game.

### Candidate Moves

See the playing engines' reported continuations, or select a dedicated analysis engine, candidate count, and search time to analyze the current position independently. Multiple candidates require the engine's **MultiPV** support. Up to five reported lines show scores, continuations, and available search statistics.

Select a candidate to preview it, or pin a continuation while the engine's reports change. Optional engine reuse keeps a matching analysis engine ready between searches; it can be closed explicitly and closes after two minutes idle. Earlier-position notices identify results that belong to a previous captured board.

### Continuation Board and Variation Tree

Step through a preview with Start, Previous, Next, End, or the move list. Open the separate Continuation Board to enter legal variations directly on its board, including drops and promotions, or add branch moves using USI notation.

Save preview lines into a persistent local study, revisit branches, add comments, remove a subtree, and undo the latest tree edit. A study can contain multiple starting positions. Export the entire tree as **study JSON**, or prepare a **KIF** for one starting position with its branches and comments. Study JSON import validates the data before replacing the current study.

**Load selected branch as game…** lets you continue a study line on the main board. The replacement dialog offers a current-game backup. Replacement starts both sides as human, disables hints, and resets clocks to 30 minutes; the other study branches stay saved.

### Mate Search

Use an engine's dedicated mate-search support to search for a forced checking mate from the current position or a custom SFEN. Stop a search, preview a returned line, inspect the raw engine reply, and download the result and settings.

A reported principal line is checked for legal replay, attacking checks, and final checkmate. Alternative defenses still depend on the engine's solver. A normal engine mate score does not establish dedicated mate-solver support; unsupported, timed-out, failed, and no-mate outcomes are reported separately.

### Engine Comparison

Compare two distinct engine configurations on the same captured position with a requested **time**, **depth**, or **node** budget and a candidate count per engine. Inspect their preferred moves, normalized scores, and actual reported search statistics. Stop both searches while retaining partial results, preview continuations, or download the comparison and settings as JSON. The latest finished or stopped comparison can be restored locally without restarting engines.

Requested budgets do not guarantee equal work or strength. Depth/node searches have a safety time limit, and individual engines may support options differently.

### Game Review

Review the current game or a selected saved study branch. Review compares a best-move search with a restricted search of the played move and estimates the evaluation loss when comparable scores are available. Stop retains completed rows. Filter larger estimated losses and inspect the played or best continuation on the Continuation Board.

Review may use two searches per move. Engines must honor restricted-move searches; a failed restriction is reported rather than assigned a misleading estimate. Missing, bounded, and mate scores may have no numeric loss.

### Engine Thinking, Evaluation, and USI Monitor

- **Engine Thinking:** inspect live depth, selective depth, nodes, nodes/second, elapsed time, hash usage, and current move when reported. Revisit up to 100 finished, stopped, failed, or replaced searches from the current application session, and preview historical candidates. This history resets on relaunch.
- **Evaluation:** plot completed, scored game-engine searches by move. Positive normalized scores favor Sente and negative scores favor Gote. The graph does not start an independent search; its tooltip retains the actual value even when the plotted range is capped.
- **USI Monitor:** inspect commands, responses, search reports, and engine errors, with engine/side labels. Advanced users can send commands to a selected live engine. Manual `stop`, `position`, `go`, or `quit` commands can interrupt play.

Scores are engine estimates, not win probabilities. The analysis tools normalize their labeled evaluations, while the USI Monitor's raw search table reflects engine-reported scores, generally from the side-to-move perspective.

## Save, load, and share games

**Save Game** stores a named game locally. Its **Export/Copy** tab generates text for copying to another program. **Load Game** opens a local save or imports pasted text with format detection and a manual format override.

Supported formats serve different purposes:

- **JSON:** application game data, including appearance and per-move clock snapshots when available.
- **KIF:** Japanese game records.
- **CSA:** Computer Shogi Association game records.
- **SFEN:** a single position, including side to move and pieces in hand; it does not preserve the played move history.
- **Study JSON:** the full saved Variation Tree, imported and exported within the study tools. This is separate from a game's JSON format.

**Export GIF** creates an animated replay from the current game. Saved games also have a GIF action in Load Game. Choose whether to include move history and clocks; clocks require recorded timing snapshots. Replays use the saved board and piece appearance when available, or the current appearance for older saves.

Local games, studies, settings, engine configurations, and cached results are not a remote backup. Export games and studies you want to keep or share before clearing application data.

## Engines

Open **Engines** from Home to add and validate executable paths, inspect engine-provided options, set favorites, clone configurations, change display names, remove configurations, and run health checks. Persistent options belong to an engine configuration; New Game also supports temporary options per player.

Use an executable built for your operating system and CPU. Install its evaluation files and supporting data as required by that engine. Options such as Hash, Threads, MultiPV, restricted searches, and mate search depend on the engine; the UI cannot add unsupported engine capabilities.

The application has built-in-engine discovery for configured development/bundle locations, but this UI repository does not contain or build the separate playing-engine source. If that engine is unavailable, add your own USI executable through Engine Management. Do not rely on the legacy root `build.sh`, which refers to engine sources no longer present here.

## Appearance

Settings provides color palettes, a **Dynamic** palette derived from board/piece colors, searchable piece themes with promotion previews and attribution, board surfaces, wallpaper galleries, sound controls, and **Slim Shogi** or **Classic Shogi** layouts. Preferences are remembered locally.

Piece options include English labels, traditional kanji sets, international and animal designs, learning arrows, ivory/vermilion, indigo porcelain, modern monochrome, Midnight Lacquer, and natural/dark Mikurajima styles.

The coordinated **Yggdrasil** set uses carved-oak pieces with large ivory rune inlays, a pale **Frost Ash** board with botanical corner carvings, and a natural **Yggdrasil Night** world-tree landscape. Runes are modern mnemonic designs, not historical translations of the kanji. Tooltips remain optional; faces carry no English role labels. Relative piece dimensions follow traditional shogi proportions, and promoted pieces retain their original size. See [Norse theme assets and generation notes](docs/norse-themes.md).

During a game, **Pieces** and **Board** cycle through available appearances. Native image discovery also supports user-added board and wallpaper images. Piece-theme credits and licenses are shown in the picker; retain the relevant third-party attributions when redistributing artwork.

## Keyboard shortcuts

Use **Command** on macOS or **Ctrl** elsewhere as the modifier:

- New game: modifier + **N**.
- Save: modifier + **S**; load: modifier + **O**.
- Settings: modifier + **comma**.
- Toggle compact menu: modifier + **Shift + M**.
- Exit to Home: modifier + **Shift + H**.
- Export GIF: modifier + **Shift + E**.
- Toggle hints: modifier + **Shift + R**.
- Cycle pieces: modifier + **Shift + P**; cycle board: modifier + **Shift + B**.
- View panels: **Command + Option + 1–8** on macOS, **Ctrl + Alt + 1–8** elsewhere, in menu order: Candidate Moves, Continuation Board / Variation Tree, Mate Search, Engine Comparison, Engine Thinking, Game Review, USI Monitor, Evaluation.

Menus display the platform-specific shortcuts. Available actions depend on the active game and desktop engine capabilities.

## Development

### Prerequisites

- Node.js satisfying Vite 7's requirement: **20.19+ on Node 20, or 22.12+**.
- npm, or Yarn Classic for the tracked `yarn.lock`.
- A current stable Rust toolchain with Cargo, plus the native build tools and libraries required by Tauri 2 for your platform. On macOS, install Xcode Command Line Tools; Windows and Linux need their corresponding Tauri development prerequisites.
- A compatible USI engine and its data for AI and engine-analysis features.

### Run the desktop application

```sh
git clone https://github.com/fgantt/ysu.git
cd ysu
npm install
npm run tauri:dev
```

The repository tracks `yarn.lock`; `yarn install --frozen-lockfile` is an alternative dependency-install workflow. npm creates a local `package-lock.json`, which is currently ignored by Git.

`tauri:dev` starts Vite and the native application. The frontend uses **http://localhost:5173**, matching Tauri's configured development URL. Stop a previous development server with Ctrl-C before starting another. An occupied port is an error rather than silently falling back to 5174. Run commands from the checkout you intend to test, especially when using Git worktrees.

If the frontend from that same checkout is already intentionally running on port 5173, start only the native app:

```sh
npm run tauri -- dev --config '{"build":{"beforeDevCommand":""}}'
```

For browser-only frontend development:

```sh
npm run dev
```

The browser can exercise frontend UI and local features, but native engine processes, desktop file dialogs, and native pop-out windows require Tauri.

### macOS SDK compatibility

The npm Tauri wrapper checks the default SDK against the installed linker and selects a compatible installed SDK when necessary. This handles the `tapi error: malformed file` / `unknown architecture` failure caused by an SDK/linker mismatch. Selection is process-local and respects an explicit `SDKROOT`; it does not change global system configuration.

When invoking Cargo directly, the npm wrapper is not involved. If the same linker error occurs, set `SDKROOT` to a compatible SDK installed on your machine for that command.

Verify the wrapper with:

```sh
node --test scripts/verify-tauri-launch.mjs
```

### Build and verify

```sh
npm test -- --run
npm run type-check
npm run build
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

`npm run build` produces the frontend in `dist/`. To create native packages:

```sh
npm run tauri:build
```

Native artifacts are produced under `src-tauri/target/release/bundle/`. Packaging runs the frontend build first. Engine distribution and evaluation data must be arranged separately; a successful frontend build alone does not create a complete engine installation.

### Repository layout

- `src/components/`: game UI, settings, practice, analysis tools, and secondary windows.
- `src/context/` and `src/hooks/`: controller context, UI state, engine sessions, and window lifecycle.
- `src/usi/`: controller and USI search coordinators.
- `src/utils/`: notation, game formats, study trees, theme assets, and analysis helpers.
- `src/data/` and `src/help/`: artwork metadata and in-app feature guides.
- `src-tauri/`: desktop commands, engine processes, engine configuration storage, capabilities, and packaging.
- `public/`: piece themes, board images, wallpapers, and sounds.
- `scripts/`: theme generation, Tauri launch compatibility, and development utilities.
- `docs/`: design notes, artwork provenance, testing records, and operational documentation.

Tests are colocated with source as `*.test.ts` and `*.test.tsx` and use Vitest, jsdom, and Testing Library. Native-window and engine compatibility checks still benefit from exercising the desktop application with the intended engine and operating system. The in-app **Help → Analysis Tools** guides explain each panel in more detail.
