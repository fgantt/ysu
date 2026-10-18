export const analysisGuides = {
  "candidates": {
  "title": "Using Candidate Moves",
  "steps": [
    "Choose View → Candidate Moves. Select an Analysis engine, Candidates, and Search time, then choose Analyze position. This uses a separate engine on a captured main-board position and leaves the game unchanged. Stop analysis cancels the search; Show game searches returns to playing-engine results.",
    "Candidate count depends on the engine’s advertised MultiPV support. Up to five reported lines are shown with rank, score, continuation, and available search metrics. Positive normalized scores favor Sente, negative favor Gote; mate and bounded scores have separate labels. An earlier-position notice means the line belongs to a previous captured board.",
    "Select a candidate to preview it. Use Pin continuation to keep that line while search reports change; unpin to follow the selection again. Separate Continuation Board opens the shared preview and Variation Tree; Reattach Continuation Board returns the preview to Candidate Moves.",
    "Keep analysis engine ready between searches is optional. Matching engine settings reuse the process; changing engine/options/candidate count starts a fresh process. Close analysis engine releases it, and idle engines close after two minutes. Stop analysis, errors, and Show game searches also release it. Hiding the panel does not stop the search."
  ]
},
  "continuation": {
  "title": "Using Continuation Board",
  "steps": [
    "Open View → Continuation Board / Variation Tree, or preview a candidate, reviewed move, comparison candidate, mate line, or saved search. Each preview starts at its own captured position and does not navigate or play moves on the main board.",
    "Use Start, Previous, Next, and End, or click a move in the continuation list. Move 0 is the captured starting position. Navigation stops before an illegal move if the line cannot be fully replayed.",
    "In the separate Continuation Board, enable Enter variation on board to explore your own line. Select a piece or a piece in hand, then a highlighted destination; choose promotion when asked. Each legal move saves a study branch at the current preview step. The embedded Candidate Moves preview is for playback.",
    "Use the Variation Tree below the board to save and revisit lines, add comments, or transfer the study. Reattach to Candidate Moves returns the preview to that panel."
  ]
},
  "variation": {
  "title": "Using Variation Tree",
  "steps": [
    "Choose Save preview line to retain the current continuation in the study, then select a starting position or move in Saved variations to revisit it. The study is stored locally and may contain several starting positions and branching lines.",
    "Enter a legal Branch move (USI), such as 7g7f or P*5e, and choose Add from preview position, or enable board entry in Continuation Board. Save comment before selecting another position. Remove selected branch deletes that subtree; Undo tree edit reverses the latest tree change.",
    "Import / export study offers Download study JSON for the entire tree. Prepare KIF for starting position exports that root, its branches, and comments as one UTF-8 KIF file. Import study accepts study JSON and replaces the current tree after validation; download a backup first.",
    "Load selected branch as game… prepares the path from its study root to the selected node. The confirmation offers Download current game backup. Replace game with this branch starts both players as human, disables hints, and restarts clocks at 30 minutes. Other study branches remain saved."
  ]
},
  "mate": {
  "title": "Using Mate Search",
  "steps": [
    "Choose View → Mate Search. Select a Mate engine and Mate search time, then Search for mate. This searches for a forced checking mate for the side to move on the captured main-board position, using a separate engine.",
    "For a puzzle, expand Search a custom SFEN, paste the position, and choose Search custom position. This position is used only for the search. Stop mate search cancels it; startup time is additional to the requested search time.",
    "Read the status: a reported mate has a principal line checked for legal replay, attacking checks, and final checkmate; alternative defenses rely on the engine’s search. No checking mate, timed out, unsupported, and failed are different outcomes. A normal mate score does not establish dedicated solver support.",
    "Choose Preview mate line when available to play it back on Continuation Board. Expand Engine mate reply for the raw response, or Download mate result and settings after the search. A different-position notice means the result uses a custom or earlier captured position."
  ]
},
  "comparison": {
  "title": "Using Engine Comparison",
  "steps": [
    "Choose View → Engine Comparison and select two different engine configurations. Choose Search budget (Time, Depth, or Nodes), its value, and Candidates per engine, then Compare position. Both independent engines receive the same captured position and requested budget.",
    "Time choices are 1–60 seconds; depth accepts 1–100 plies and nodes accepts 1–1,000,000,000. Depth/node searches have a 60-second safety limit. Engine support varies and equal budgets do not imply equal strength. Inspect reported depth, nodes, time, and effective settings rather than assuming identical work.",
    "Stop both engines retains partial results. Compare preferred first moves and normalized scores: positive favors Sente. A numeric difference is unavailable for missing, mate, or bounded scores. Select a result line to preview it on Continuation Board without playing it in the game.",
    "Download comparison results and settings preserves the run as JSON. The latest finished or stopped comparison is restored locally when available without starting a new search. Earlier captured position means the result belongs to another board; choose Compare position to run again on the current board."
  ]
},
  "review": {
  "title": "Using Game Review",
  "steps": [
    "Choose View → Game Review. Select Current game or Selected saved branch as Review scope, choose a Review engine and Time per search, then Review game or Review selected branch. A branch becomes available after selecting a saved Variation Tree path with moves.",
    "Review captures the record and compares best-move and restricted played-move searches. It can take two searches per reviewed move. Stop review retains completed rows. Estimated loss is an engine estimate; missing, bounded, or mate scores may have no numeric loss. Show moves with estimated loss of 150 cp or more filters the list and navigation.",
    "Select a Reviewed move or use First, Previous, Next, and Last reviewed move. Choose Show played continuation or Show best continuation, then step through it in Continuation Board. With a navigation button focused, Left/Right and Home/End navigate. Previews begin before the selected move and leave the main game unchanged.",
    "Expand Captured starting position to inspect the SFEN. An earlier-snapshot notice means the game or selected branch changed since the review; run the review again to include the new record. New results do not automatically replace your preview."
  ]
},
  "evaluation": {
  "title": "Using Evaluation",
  "steps": [
    "Choose View → Evaluation during an engine-backed game. Points appear when a game engine completes a scored search. This panel displays those evaluations; it does not start a separate analysis.",
    "The horizontal axis is move number and the vertical axis shows score in thousands of centipawns. Positive values favor Sente, negative favor Gote, and zero is even. Hover over a point for its move and exact score; the headline and Evaluation details describe the latest position and trend.",
    "The plotted line is capped visually at ±2,000 cp; the point tooltip and current score retain the actual evaluation. Scores are engine estimates, not win probabilities or guaranteed outcomes. Resize the panel to give the graph more room."
  ]
},
  "thinking": {
  "title": "Using Engine Thinking",
  "steps": [
    "Choose View → Engine Thinking. Live searches shows game, dedicated analysis, review, and comparison engine searches. Start a search in the relevant panel or wait for an AI turn to see metrics.",
    "Depth and Selective depth describe explored plies; Nodes counts positions; Nodes / second is search speed; Search time is engine-reported time; Hash used is reported table occupancy; Current move is the move under examination. Unavailable means the engine did not report the field.",
    "Choose Search history and select a Saved search to revisit the latest 100 finished, stopped, failed, or replaced searches in this app session. Entries show source, engine, outcome, depth, timestamps, and captured position. History is recorded even while the panel is hidden; it resets on relaunch. Dedicated mate searches are separate.",
    "Choose Preview candidate for a historical line to open Continuation Board at its original position. Clear finished history removes finished entries while active searches continue. A selected search stays selected until you choose another, clear it, or it falls out of the history limit."
  ]
},

  engine: {
    title: 'Using Engine Monitor',
    steps: [
      'Choose View → USI Monitor in a game. Playing engines are labeled Sente (Black) or Gote (White); dedicated searches may also appear with their analysis role. Start a search to see engine communication.',
      'Engine Monitor shows the most recent command sent to each engine and its latest response, with timestamps. Look for bestmove after a search or ERROR messages when troubleshooting.',
      'To send a manual command, enter it in the input for the intended engine and press Enter or SEND. This controls the live engine: commands such as stop, position, go, or quit can interrupt the game.',
    ],
  },
  search: {
    title: 'Using Search',
    steps: [
      'Choose Search in USI Monitor while an AI is thinking or Show Hints is enabled for a human turn. Results appear only when the engine reports depth, a centipawn score, and nodes.',
      'Rows are newest first and retain earlier search reports. They are engine reports, not a move-by-move evaluation of the game. Use Candidate Moves or Engine Thinking for continuations tied to a captured starting position.',
      'Elapsed is search time in seconds; Rank is the MultiPV candidate number (1 is the top line); Depth is the search depth, optionally followed by selective depth. Nodes counts searched positions and NPS means nodes per second.',
      'Score is the raw engine centipawn evaluation, generally from the side-to-move perspective, not a fixed Black advantage or a win percentage. Mate scores are not displayed in this table. PV is the predicted continuation in USI notation, not moves already played.',
      'Read 7g7f as a move from 7g to 7f, P*5e as a pawn drop on 5e, and a trailing + as promotion. Multiple ranks require an engine that supports MultiPV and an appropriate value in Engine Options.',
    ],
  },
  history: {
    title: 'Using Communication History',
    steps: [
      'Choose View → USI Monitor to inspect commands and responses in the browser communication monitor. Last Sent and Last Received summarize the latest communication.',
      'Select a Session to filter the history to one engine session, or choose all sessions. Enable Show Debug to include DEBUG messages.',
      'In the history, > marks a sent command and < marks a received response. Timestamps and session IDs help identify which engine produced a message. The history scrolls to new messages automatically.',
    ],
  },
};

export const featureGuides = [
  { id: 'playing', label: 'Playing', title: 'Start and play a game', articles: [
    { title: 'Players and starting position', text: 'From Home, choose Start New Game. Set each player to Human or AI for local two-player play, play against an engine, or watch two engines. Black (Sente) moves first in the standard position; White is Gote. For each AI, select an installed engine and optionally adjust Engine Options for this game. Expand Initial Position to choose a preset or Custom SFEN; leave the standard SFEN field empty for a normal game.' },
    { title: 'Arrange the workspace', text: 'Drag the game workspace by its headings to reposition the board, hands, clocks, history, and controls together. Drag a corner to resize it proportionally. Double-click a heading to reset position; double-click a corner or press Home with that corner focused to reset size. Corner arrow keys adjust size. Click an exposed part of the game or an analysis panel to bring it forward.' },
    { title: 'Clocks', text: 'Set Minutes per side and Byoyomi in seconds before starting. After the main time runs out, byoyomi provides a fresh allowance for each move. The arrow beside a clock identifies the side to move. Watch the clock while choosing a move.' },
    { title: 'Move, capture, drop, and promote', text: 'Click your piece, then a highlighted legal destination, or drag a board piece to its destination. To drop a captured piece, select it from your hand and click a legal empty square. When the promotion choice appears, choose whether to promote. Promotion is mandatory when an unpromoted pawn, lance, or knight would otherwise have no future move.' },
    { title: 'Hints and engine thinking', text: 'Choose Show Hints during a game with a human player to request an engine recommendation; Hide Hints turns it off. An arrow indicates a suggested move, a highlighted hand piece and destination indicate a drop, and + indicates promotion. You still make the move yourself. Choose the Recommendation Engine and its options in Settings. Show Engine Thinking in Display settings shows the engine’s current candidate, which can change during search.' },
    { title: 'Move history and game controls', text: 'Move History lists the played moves in Black and White columns. Change its notation in Settings. New Game opens game setup; Exit returns home after confirmation. Save the game before replacing it or leaving if you want to keep it.' },
  ] },
  { id: 'files', label: 'Save & Load', title: 'Save, export, load, and import', articles: [
    { title: 'Save locally or copy text', text: 'Choose Save Game, enter a Game Name, select a format, and save to the app’s local storage. In the Export tab, select a format and use Copy to Clipboard to transfer the text elsewhere. Local saves belong to this app installation; keep an exported copy for sharing or backup.' },
    { title: 'Choose a format', text: 'SFEN stores a position, including the side to move and pieces in hand, rather than the played move history. CSA and KIF are game-record formats. JSON preserves the app’s game data, including appearance and per-move clock snapshots when available. Choose CSA, KIF, or JSON to retain the moves; use study JSON to preserve the full Variation Tree.' },
    { title: 'Animated GIF replays', text: 'Choose Export GIF from the game menu for an animated replay, or use GIF beside a saved game in Load Game. When the export dialog appears, choose whether to include Move history and Clocks, then Download GIF. Clocks require per-move timing snapshots. Saved appearance is used when present; older saves use the current board and pieces. Wait for rendering to complete before closing.' },
    { title: 'Load or import', text: 'Choose Load Game and load a named local save from the storage tab. The app detects the stored format. Delete removes that saved entry. To import, paste game data in the Import tab. Use automatic format detection, or turn it off and select SFEN, CSA, KIF, or JSON yourself. If parsing fails, correct the text or format and try again. Loading replaces the current game, so save it first if needed.' },
  ] },
  { id: 'engines', label: 'Engines', title: 'Install and configure engines', articles: [
    { title: 'Add a USI engine', text: 'Engine features require the native desktop application. From Home, open Engines. Enter an Engine Name and use Browse to select an engine executable for your operating system, or enter its path. Wait for validation, then choose Add Engine. Supply any evaluation data or other files required by that engine according to its own instructions.' },
    { title: 'Manage configurations', text: 'Mark an engine with the star to make it a favorite for selection. Open its options to change the display name and engine-provided settings, then Save Options. Reset to Default Values restores the values in the form; save to apply them. Clone creates another configuration of the engine for different settings. Remove deletes its configuration. Use the health check to check configured engines.' },
    { title: 'Game options and troubleshooting', text: 'Engine Options in New Game applies temporary settings to that player for the new game. Available options depend on the engine: use its documentation for settings such as Hash, Threads, and MultiPV. If an engine cannot start, check the executable path, platform compatibility, and required data files, then inspect USI Monitor for responses and errors.' },
  ] },
  { id: 'settings', label: 'Settings & Practice', title: 'Customize and practice', articles: [
    { title: 'Appearance and display', text: 'Open Settings from Home or the game. In Appearance, select a color palette preview or Dynamic. Search and filter the piece-theme gallery, then select a card; the full preview shows promotion pairs and attribution. In Backgrounds, browse or search board surfaces and wallpaper scenes. Choose Slim Shogi or Classic Shogi in Display. Enable Show Attacked Pieces, Show Piece Tooltips, or Show Engine Thinking as learning aids. The Pieces and Board buttons during a game cycle their available appearances.' },
    { title: 'Notation and sounds', text: 'In Notation, choose English, KIF, USI, or CSA for the move log. In Display, enable Piece Movement Sounds and adjust Volume. Settings are remembered locally for later sessions. Display also provides Secondary window transparency (0–60%) and Restore opaque windows; the setting applies to analysis panels and native secondary windows.' },
    { title: 'Practice exercises', text: 'From Home, open Practice and choose Name Identification, Movement Pattern Recognition, or Promotion Matching. Select an answer, read the feedback, and choose Next Question when available. Finish Exercise returns you to practice after the score screen. The recognition exercises include randomized questions and promoted pieces; repeat them to build familiarity.' },
    { title: 'Game keyboard shortcuts', text: 'On macOS use Command; elsewhere use Ctrl. New Game: modifier+N; Save Game: modifier+S; Load Game: modifier+O; Settings: modifier+comma. Add Shift for M (toggle compact menu), H (Exit), E (Export GIF), R (Hints), P (Pieces), or B (Board). View windows use modifier+Alt/Option+1–8 in menu order. Menu buttons display the shortcuts.' },
    { title: 'About', text: 'Open About from Home for application information. Use the Rules, Piece Movements, and Kifu Notation sections of this help guide when learning the game.' },
  ] },
];

export const secondaryWindowInstructions = [
  'Open panels from the game’s View menu. Use Command+Option+1–8 on macOS or Ctrl+Alt+1–8 elsewhere, in View-menu order. Disabled entries require the desktop engine features or an available engine-backed game.',
  'Drag a panel heading to float it within the app, resize from its corner, and click an exposed panel to bring it forward. Dock in original location restores its place. Pop out window opens a separate native window; Return to main window docks it again.',
  'Hide panel or Close window dismisses the view; reopen it through View. Hiding or closing a view does not stop main-owned analysis sessions. Use the tool’s Stop control to cancel a running search. Settings → Display controls secondary-window transparency.',
];
export const panelGuideByTitle = {
  'Engine Thinking': 'thinking',
  'Continuation Board': 'continuation',
  'Game Review': 'review',
  'Engine Comparison': 'comparison',
  'Mate Search': 'mate',
} as const satisfies Record<string, keyof typeof analysisGuides>;
