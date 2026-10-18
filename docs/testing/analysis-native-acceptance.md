# Analysis native acceptance — October 7, 2026

Tested the current debug app bundle from the codex/ui-codex-1 worktree using a fresh human-versus-human game. The user's existing development process was left running. Temporary study edits were undone afterward.

## Verified

- Candidate Moves pop-out, Return, Close without a launcher button, and shortcut reopening.
- Evaluation pop-out and Return with the graph retained.
- USI Monitor pop-out, Close without a launcher, and shortcut reopening.
- Continuation Board pop-out, saved-node selection and Return.
- Engine Thinking, Mate Search and Engine Comparison pop-out and Return.
- Game Review pop-out, navigation into Continuation Board and Return.
- Menu shortcut and View flyout containing eight window actions, icons and platform shortcuts.
- Dedicated Apery analysis completed with three candidates and captured thinking history.
- Selected a saved node in popped-out Continuation Board, opened the replacement dialog in the main window, and replaced the fresh test game with its one-move ancestry. Main history and board showed 7g7f, Gote to move, human players and fresh clocks.
- Reviewed the imported move with YaneuraOu; best-line preview opened the correct captured position in popped-out Continuation Board.
- Reviewed a six-move saved branch and navigated completed review moves and played/best lines in both main and popped-out views without changing the main game.

## Observed engine limitation

YaneuraOu NNUE V9.00Git 64APPLEM1 TOURNAMENT did not honor a restricted played-move search on the six-move branch. Review stopped at search 11 of 12 with “The engine did not honor the restricted move search.” Five completed review rows remained available. This is a compatibility failure handled by the existing validation; the interrupted review must not be treated as complete or assigned an invented loss estimate.

## Remaining manual coverage

OS-level Evaluation resize, USI Return, prolonged engine reuse, full mate-search execution and full equal-budget comparison were not exercised in this native pass. Automated tests cover those coordinators and shared window lifecycle behavior; this pass does not establish Windows/Linux behavior.

## Local build note

The installed macOS 27 SDK produced a linker error. The current debug app built successfully using the installed 14.4 SDK for that command only:

```sh
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX14.4.sdk npm run tauri -- build --debug --bundles app
```

No global SDK or system configuration was changed.
