import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { gameMenuShortcut, useGameMenuShortcuts, type GameMenuCommand } from './useGameMenuShortcuts';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Controls({ actions, enabled = true }: { actions: Partial<Record<GameMenuCommand, () => void>>; enabled?: boolean }) {
  useGameMenuShortcuts(actions, enabled);
  return null;
}
it('dispatches Control shortcuts with the menu closed and prevents browser defaults', () => {
  const actions = { menu: vi.fn(), newGame: vi.fn(), save: vi.fn(), load: vi.fn(), settings: vi.fn(), exportGif: vi.fn(), exit: vi.fn(), hints: vi.fn(), pieces: vi.fn(), board: vi.fn() };
  render(<Controls actions={actions} />);
  for (const [id, code, shiftKey] of [['menu', 'KeyM', true], ['newGame', 'KeyN', false], ['save', 'KeyS', false], ['load', 'KeyO', false], ['settings', 'Comma', false], ['exportGif', 'KeyE', true], ['exit', 'KeyH', true], ['hints', 'KeyR', true], ['pieces', 'KeyP', true], ['board', 'KeyB', true]] as const) {
    expect(fireEvent.keyDown(window, { code, ctrlKey: true, shiftKey })).toBe(false);
    expect(actions[id]).toHaveBeenCalledOnce();
  }
  expect(gameMenuShortcut('save')).toEqual({ label: 'Ctrl+S', aria: 'Control+S' });
});
it('uses Command on Mac and ignores Control, repeats, alternate modifiers and dialogs', () => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  const save = vi.fn();
  const view = render(<Controls actions={{ save }} />);
  fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true });
  fireEvent.keyDown(window, { code: 'KeyS', metaKey: true, repeat: true });
  fireEvent.keyDown(window, { code: 'KeyS', metaKey: true, altKey: true });
  expect(save).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { code: 'KeyS', metaKey: true });
  expect(save).toHaveBeenCalledOnce();
  expect(gameMenuShortcut('newGame').label).toBe('⌘N');
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
  fireEvent.keyDown(window, { code: 'KeyS', metaKey: true });
  expect(save).toHaveBeenCalledOnce(); dialog.remove();
  view.unmount();
  fireEvent.keyDown(window, { code: 'KeyS', metaKey: true });
  expect(save).toHaveBeenCalledOnce();
});
