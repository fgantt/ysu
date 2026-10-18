import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecondaryWindowConfig } from './useSecondaryWindow';

let closeRequested: ((event: { preventDefault: () => void }) => Promise<void>) | undefined;
const close = vi.fn(async () => undefined);
const emitTo = vi.fn(async (_target?: string, _event?: string, _payload?: unknown) => undefined);
const unlisten = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: (target: string, event: string, payload?: unknown) => payload === undefined
    ? emitTo(target, event)
    : emitTo(target, event, payload),
  listen: vi.fn(async () => unlisten),
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close,
    onCloseRequested: vi.fn(async (handler: typeof closeRequested) => { closeRequested = handler; return unlisten; }),
    onMoved: vi.fn(async () => unlisten),
    onResized: vi.fn(async () => unlisten),
    outerPosition: vi.fn(async () => ({ x: 0, y: 0 })),
    innerSize: vi.fn(async () => ({ width: 700, height: 400 })),
  }),
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: class {} }));

import { readSecondaryWindowPayload, useSecondaryWindow } from './useSecondaryWindow';

const config: SecondaryWindowConfig = {
  label: 'test-panel', route: '/monitor/test', queryKey: 'state',
  updateEvent: 'test-panel:state', closeEvent: 'test-panel:closed',
  boundsKey: 'test-bounds', title: 'Test', errorNoun: 'test',
  defaultWidth: 700, defaultHeight: 400, minWidth: 420, minHeight: 260,
};

describe('useSecondaryWindow', () => {
  beforeEach(() => { closeRequested = undefined; close.mockClear(); emitTo.mockReset(); emitTo.mockResolvedValue(undefined); });

  it('forwards shortcut toggles from a popped-out window to the main owner', async () => {
    renderHook(() => useSecondaryWindow(config, { value: 1 }));
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5', ctrlKey: true, altKey: true, bubbles: true })); });
    expect(emitTo).toHaveBeenCalledWith('main', 'secondary-view:toggle', 'thinking');
    expect(close).not.toHaveBeenCalled();
  });

  it('always closes after notifying the main window', async () => {
    renderHook(() => useSecondaryWindow(config, { value: 1 }));
    await waitFor(() => expect(closeRequested).toBeDefined());
    const preventDefault = vi.fn();
    await act(async () => { await closeRequested?.({ preventDefault }); });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(emitTo).toHaveBeenCalledWith('main', 'test-panel:closed');
    expect(close).toHaveBeenCalledOnce();
  });

  it('still closes if the main-window notification fails', async () => {
    emitTo.mockRejectedValueOnce(new Error('main unavailable'));
    renderHook(() => useSecondaryWindow(config, { value: 1 }));
    await waitFor(() => expect(closeRequested).toBeDefined());
    await act(async () => { await closeRequested?.({ preventDefault: vi.fn() }).catch(() => undefined); });
    expect(close).toHaveBeenCalledOnce();
  });
});


describe('secondary window bootstrap', () => {
  it('loads large initial payloads from shared storage instead of the URL', () => {
    const payload = { rows: Array.from({ length: 500 }, (_, index) => ({ ply: index })) };
    localStorage.setItem('secondary-window-bootstrap:review-monitor', JSON.stringify(payload));
    window.history.replaceState({}, '', '?bootstrap=review-monitor');
    expect(readSecondaryWindowPayload('state', null)).toEqual(payload);
    window.history.replaceState({}, '', '/');
    localStorage.clear();
  });
  it('falls back safely when the bootstrap payload is unavailable', () => {
    window.history.replaceState({}, '', '?bootstrap=missing');
    expect(readSecondaryWindowPayload('state', { empty: true })).toEqual({ empty: true });
    window.history.replaceState({}, '', '/');
  });
});

it('distinguishes returning a native panel from closing it', async () => {
  const { returnSecondaryWindow } = await import('./useSecondaryWindow');
  renderHook(() => useSecondaryWindow(config, { value: 1 }));
  await waitFor(() => expect(closeRequested).toBeDefined());
  await act(async () => { await returnSecondaryWindow(config); });
  close.mockClear(); emitTo.mockClear();
  await act(async () => { await closeRequested?.({ preventDefault: vi.fn() }); });
  expect(emitTo).toHaveBeenCalledWith('main', 'test-panel:closed', { redock: true });
  expect(close).toHaveBeenCalledOnce();
});
