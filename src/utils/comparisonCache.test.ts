import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { ComparisonState } from '../usi/engineComparison';
import { COMPARISON_STORAGE_KEY, parseComparisonCache, restoreComparison, saveComparison } from './comparisonCache';
const root = InitialPositionSFEN.STANDARD;
const result: ComparisonState = {
  version: 1, busy: false, rootSfen: root, seconds: 60, candidates: 1,
  budget: { kind: 'nodes', value: 100000 }, engines: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], options: [{ Threads: '2' }, { Threads: '2' }],
  sides: [{ status: 'complete', search: { engineId: 'a-run', rootSfen: root, complete: true, lines: [{ rank: 1, score: 12, moves: ['7g7f', '3c3d'] }], metrics: { depth: 10, nodes: 100123 } } }, { status: 'error', error: 'Engine unavailable' }],
};
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('comparison cache', () => {
  it('restores completed and partial results with root, budget and settings', () => {
    saveComparison(result);
    expect(restoreComparison()).toEqual({ ...result, restored: true });
  });
  it('reads older time-only results', () => {
    expect(parseComparisonCache(JSON.stringify({ ...result, budget: undefined, seconds: 5 }))?.seconds).toBe(5);
  });
  it.each([
    { ...result, busy: true }, { ...result, version: 2 }, { ...result, rootSfen: 'invalid' },
    { ...result, budget: { kind: 'nodes', value: -1 } }, { ...result, engines: [{ id: 'a', name: 'A' }] },
    { ...result, options: ['invalid', {}] },
    { ...result, sides: [{ ...result.sides[0], status: 'running' }, result.sides[1]] },
    { ...result, sides: [{ status: 'complete', search: { ...result.sides[0].search, rootSfen: root.replace(' b ', ' w ') } }, result.sides[1]] },
    { ...result, sides: [{ status: 'complete', search: { ...result.sides[0].search, lines: [{ rank: 1, moves: ['7g7e'] }] } }, result.sides[1]] },
  ])('rejects invalid or active data %#', value => {
    expect(parseComparisonCache(JSON.stringify(value))).toBeNull();
  });
  it('preserves corrupt saved data until a new finished comparison replaces it', () => {
    localStorage.setItem(COMPARISON_STORAGE_KEY, 'corrupt');
    expect(restoreComparison()).toBeNull();
    saveComparison({ ...result, busy: true });
    expect(localStorage.getItem(COMPARISON_STORAGE_KEY)).toBe('corrupt');
    saveComparison(result);
    expect(restoreComparison()?.rootSfen).toBe(root);
  });
  it('handles oversized files and unavailable storage without disrupting analysis', () => {
    expect(parseComparisonCache(' '.repeat(2000001))).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(() => saveComparison(result)).not.toThrow();
  });
});
