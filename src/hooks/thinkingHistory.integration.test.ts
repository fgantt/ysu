import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import { thinkingHistoryStore } from '../utils/thinkingHistory';
import { useAnalysisSession } from './useAnalysisSession';
import { useGameReview } from './useGameReview';

const bridge = vi.hoisted(() => ({ callbacks: new Map<string, (message: string) => void>(), roots: new Map<string, string>() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => ({ success: true, data: {} })) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (event: string, callback: (event: { payload: string }) => void) => {
  if (event.startsWith('usi-message::')) bridge.callbacks.set(event.slice('usi-message::'.length), message => callback({ payload: message }));
  return () => { bridge.callbacks.delete(event.slice('usi-message::'.length)); };
}) }));
const engine: EngineConfig = { id: 'a', name: 'A', display_name: 'A', path: '/a', enabled: true, is_builtin: false, is_favorite: false, created_at: '' };
const root = InitialPositionSFEN.STANDARD;
afterEach(() => { cleanup(); thinkingHistoryStore.clearFinished(); bridge.callbacks.clear(); bridge.roots.clear(); localStorage.clear(); vi.restoreAllMocks(); });

it('captures dedicated analysis while its view is absent and retains stopped metrics', async () => {
  const view = renderHook(() => useAnalysisSession([engine]));
  await act(async () => { view.result.current.onAction({ type: 'start', engineId: 'a', rootSfen: root, candidates: 1, seconds: 5 }); });
  const callback = [...bridge.callbacks.values()][0];
  await act(async () => { callback('info depth 8 nodes 500 pv 7g7f 3c3d'); view.result.current.onAction({ type: 'stop' }); });
  const entry = thinkingHistoryStore.getSnapshot().find(value => value.source === 'analysis')!;
  expect(entry.status).toBe('stopped');
  expect(entry.search.metrics?.nodes).toBe(500);
  expect(entry.search.rootSfen).toBe(root);
});

it('retains all same-root best/played review jobs even when their transitions are batched', async () => {
  const { invoke } = await import('@tauri-apps/api/core');
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === 'send_usi_command') {
      const { engineId, command: message } = args as { engineId: string; command: string };
      if (message.startsWith('position sfen ')) bridge.roots.set(engineId, message.slice(14));
      if (message.startsWith('go ')) {
        const first = message.includes('searchmoves ') ? message.split('searchmoves ')[1] : bridge.roots.get(engineId)?.includes(' w ') ? '3c3d' : '7g7f';
        bridge.callbacks.get(engineId)?.(`info depth 4 nodes 100 score cp 12 pv ${first}`);
        bridge.callbacks.get(engineId)?.(`bestmove ${first}`);
      }
    }
    return { success: true, data: {} } as never;
  });
  const view = renderHook(() => useGameReview({ initialSfen: root, moves: ['7g7f', '3c3d'] }, [engine]));
  await act(async () => {
    view.result.current.start('a', 1);
    for (let index = 0; index < 250; index++) await Promise.resolve();
  });
  const history = thinkingHistoryStore.getSnapshot().filter(value => value.source === 'review');
  expect(history).toHaveLength(4);
  expect(new Set(history.map(value => value.id)).size).toBe(4);
  expect(history.every(value => value.status === 'complete' && value.search.metrics?.nodes === 100)).toBe(true);
  expect(history.filter(value => value.search.rootSfen === root)).toHaveLength(2);
});


it('persists reuse preference and releases the retained engine when switching to game searches', async () => {
  const { invoke } = await import('@tauri-apps/api/core');
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === 'send_usi_command') {
      const { engineId, command: message } = args as { engineId: string; command: string };
      if (message === 'isready') bridge.callbacks.get(engineId)?.('readyok');
      if (message.startsWith('go ')) bridge.callbacks.get(engineId)?.('bestmove 7g7f');
    }
    return { success: true, data: {} } as never;
  });
  const view = renderHook(() => useAnalysisSession([engine]));
  await act(async () => { view.result.current.onAction({ type: 'reuse', enabled: true }); });
  expect(localStorage.getItem('shogi-reuse-analysis-engine')).toBe('true');
  await act(async () => { view.result.current.onAction({ type: 'start', engineId: 'a', rootSfen: root, candidates: 1, seconds: 1 }); for (let i = 0; i < 100; i++) await Promise.resolve(); });
  expect(view.result.current.state.engineReady).toBe(true);
  await act(async () => { view.result.current.onAction({ type: 'clear' }); });
  expect(view.result.current.state.engineReady).toBe(false);
  expect(view.result.current.state.status).toBe('idle');
  view.unmount();
  const second = renderHook(() => useAnalysisSession([engine]));
  expect(second.result.current.state.reuseEnabled).toBe(true);
});
