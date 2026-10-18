import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import { COMPARISON_STORAGE_KEY } from '../utils/comparisonCache';
import { useEngineComparison } from './useEngineComparison';
const mock = vi.hoisted(() => ({
  options: vi.fn(async () => ({})), spawn: vi.fn(async () => {}), send: vi.fn(async (_id: string, _command: string) => {}), terminate: vi.fn(async () => {}),
  listen: vi.fn(async () => () => {}),
}));
vi.mock('./useAnalysisSession', () => ({ analysisTransport: mock }));
const root = InitialPositionSFEN.STANDARD;
const engines: EngineConfig[] = ['a', 'b'].map(id => ({ id, name: id, display_name: id, path: '/engine', enabled: true, is_builtin: false, is_favorite: false, created_at: '' }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
it('restores data without starting engines and runs only on an explicit comparison action', async () => {
  localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify({ version: 1, busy: false, rootSfen: root, seconds: 60, candidates: 1, budget: { kind: 'depth', value: 4 }, engines: engines.map(({ id, name }) => ({ id, name })), sides: [{ status: 'stopped' }, { status: 'error' }] }));
  const view = renderHook(() => useEngineComparison(engines, root));
  expect(view.result.current.state.restored).toBe(true);
  expect(mock.spawn).not.toHaveBeenCalled();
  expect(mock.listen).not.toHaveBeenCalled();
  await act(async () => {
    view.result.current.onAction({ type: 'comparison-start', engineIds: ['a', 'b'], seconds: 60, candidates: 1, budget: { kind: 'nodes', value: 100000 } });
    for (let index = 0; index < 20; index++) await Promise.resolve();
  });
  expect(mock.spawn).toHaveBeenCalledTimes(2);
  expect(mock.send.mock.calls.filter(call => call[1] === 'go nodes 100000')).toHaveLength(2);
  expect(view.result.current.state.restored).toBeUndefined();
  await act(async () => { view.result.current.onAction({ type: 'comparison-stop' }); });
  expect(JSON.parse(localStorage.getItem(COMPARISON_STORAGE_KEY)!).budget).toEqual({ kind: 'nodes', value: 100000 });
});
