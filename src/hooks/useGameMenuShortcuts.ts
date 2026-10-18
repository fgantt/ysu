import { useEffect } from 'react';
export const gameMenuCommands = {
  menu: { code: 'KeyM', key: 'M', shift: true },
  exit: { code: 'KeyH', key: 'H', shift: true },
  newGame: { code: 'KeyN', key: 'N', shift: false },
  save: { code: 'KeyS', key: 'S', shift: false },
  load: { code: 'KeyO', key: 'O', shift: false },
  exportGif: { code: 'KeyE', key: 'E', shift: true },
  hints: { code: 'KeyR', key: 'R', shift: true },
  pieces: { code: 'KeyP', key: 'P', shift: true },
  board: { code: 'KeyB', key: 'B', shift: true },
  settings: { code: 'Comma', key: ',', shift: false },
} as const;
export type GameMenuCommand = keyof typeof gameMenuCommands;
export const isMacMenuPlatform = () => /Mac|iPhone|iPad/.test(navigator.platform);
export function gameMenuShortcut(command: GameMenuCommand) {
  const value = gameMenuCommands[command];
  const mac = isMacMenuPlatform();
  return { label: `${mac ? '⌘' : 'Ctrl+'}${value.shift ? (mac ? '⇧' : 'Shift+') : ''}${value.key}`, aria: `${mac ? 'Meta' : 'Control'}+${value.shift ? 'Shift+' : ''}${value.key}` };
}
/** Mounted by the game page, so shortcuts work while the compact menu is closed. */
export function useGameMenuShortcuts(actions: Partial<Record<GameMenuCommand, () => void>>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      const mac = isMacMenuPlatform();
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)) return;
      // Leave shortcuts to the active dialog until it has been dismissed.
      if (document.querySelector('[role="dialog"], [aria-modal="true"], .modal-overlay')) return;
      for (const [id, value] of Object.entries(gameMenuCommands)) {
        if (event.code === value.code && event.shiftKey === value.shift) {
          const action = actions[id as GameMenuCommand];
          if (action) { event.preventDefault(); action(); }
          return;
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [actions, enabled]);
}
