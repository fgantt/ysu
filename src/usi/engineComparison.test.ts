import { describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import type { AnalysisTransport } from './analysisSession';
import { EngineComparisonSession, type ComparisonState } from './engineComparison';
const left: EngineConfig = { id: 'left', name: 'Left', display_name: 'Left engine', path: '/left', enabled: true, is_builtin: false, is_favorite: false, created_at: '', metadata: { name: 'Left', options: [{ name: 'MultiPV', option_type: 'spin', min: '1', max: '5', var: [] }, { name: 'Threads', option_type: 'spin', min: '1', max: '16', var: [] }] } };
const right: EngineConfig = { ...left, id: 'right', path: '/right', display_name: 'Right engine' };
const root = InitialPositionSFEN.STANDARD;
async function settle() { for (let index = 0; index < 20; index++) await Promise.resolve(); }
function fixture() {
  const callbacks = new Map<string, (message: string) => void>();
  const states: ComparisonState[] = [];
  const saved = { MultiPV: '5', Threads: '12', EvalFile: '/eval' };
  const unlisten = vi.fn();
  const transport: AnalysisTransport = {
    options: vi.fn(async () => saved),
    listen: vi.fn(async (id, callback) => { callbacks.set(id, callback); return unlisten; }),
    spawn: vi.fn(async () => {}), send: vi.fn(async () => {}), terminate: vi.fn(async () => {}),
  };
  const session = new EngineComparisonSession(transport, state => states.push(state));
  return { session, transport, states, callbacks, saved, unlisten };
}
describe('equal-budget engine comparison', () => {
  it('starts distinct processes on the same root with frozen settings and retains both results', async () => {
    const f = fixture();
    await f.session.start([left, right], root, 1, 3);
    const spawns = vi.mocked(f.transport.spawn).mock.calls;
    expect(spawns).toHaveLength(2);
    expect(spawns[0][0]).not.toBe(spawns[1][0]);
    for (const [id, , options] of spawns) {
      expect(options).toEqual({ MultiPV: '3', Threads: '2', EvalFile: '/eval' });
      expect(f.transport.send).toHaveBeenCalledWith(id, `position sfen ${root}`);
      expect(f.transport.send).toHaveBeenCalledWith(id, 'go movetime 1000');
      f.callbacks.get(id)!('info depth 10 score cp 42 pv 7g7f 3c3d');
      f.callbacks.get(id)!('bestmove 7g7f');
    }
    await settle();
    expect(f.states.at(-1)?.busy).toBe(false);
    expect(f.states.at(-1)?.sides.map(side => side.status)).toEqual(['complete', 'complete']);
    expect(f.states.at(-1)?.sides.every(side => side.search?.rootSfen === root)).toBe(true);
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    expect(f.unlisten).toHaveBeenCalledTimes(2);
    expect(f.saved.Threads).toBe('12');
    await f.session.dispose();
  });
  it('stops both engines and ignores late messages', async () => {
    const f = fixture();
    await f.session.start([left, right], root, 30, 1);
    await f.session.stop();
    expect(f.states.at(-1)?.sides.map(side => side.status)).toEqual(['stopped', 'stopped']);
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    const count = f.states.length;
    for (const callback of f.callbacks.values()) callback('info score cp 100 pv 2g2f');
    expect(f.states).toHaveLength(count);
    await f.session.dispose();
  });
  it('cancels while reading options before either process is spawned', async () => {
    const f = fixture();
    let resolve!: (options: Record<string, string>) => void;
    const pending = new Promise<Record<string, string>>(done => { resolve = done; });
    f.transport.options = vi.fn(() => pending);
    const start = f.session.start([left, right], root, 1, 1);
    const stop = f.session.stop();
    resolve({});
    await Promise.all([start, stop]);
    expect(f.transport.spawn).not.toHaveBeenCalled();
    expect(f.states.at(-1)?.busy).toBe(false);
    expect(f.states.at(-1)?.sides.map(side => side.status)).toEqual(['stopped', 'stopped']);
    await f.session.dispose();
  });
  it('keeps the other engine running when one fails startup', async () => {
    const f = fixture();
    f.transport.spawn = vi.fn(async (_id, engine) => { if (engine.id === left.id) throw new Error('Missing evaluation file'); });
    await f.session.start([left, right], root, 1, 1);
    expect(f.states.at(-1)?.sides.map(side => side.status)).toEqual(['error', 'running']);
    expect(f.states.at(-1)?.busy).toBe(true);
    const id = vi.mocked(f.transport.spawn).mock.calls.find(call => call[1].id === right.id)![0];
    f.callbacks.get(id)!('info score cp 15 pv 2g2f');
    f.callbacks.get(id)!('bestmove 2g2f');
    await settle();
    expect(f.states.at(-1)?.busy).toBe(false);
    expect(f.states.at(-1)?.sides[1].search?.lines).toHaveLength(1);
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    await f.session.dispose();
  });
  it('rejects invalid pairs and unsupported candidate counts without spawning', async () => {
    const f = fixture();
    await f.session.start([left, left], root, 1, 1);
    expect(f.states.at(-1)?.error).toBeTruthy();
    await f.session.start([left, { ...right, metadata: undefined }], root, 1, 3);
    expect(f.transport.spawn).not.toHaveBeenCalled();
    await f.session.dispose();
  });
  it('disposes both active processes and permits fresh comparison after completion', async () => {
    const f = fixture();
    await f.session.start([left, right], root, 1, 1);
    await f.session.stop();
    await f.session.start([left, right], root, 1, 1);
    expect(new Set(vi.mocked(f.transport.spawn).mock.calls.map(call => call[0])).size).toBe(4);
    await f.session.dispose();
    expect(f.transport.terminate).toHaveBeenCalledTimes(4);
  });
});

it('reports an options-loading error per side and still completes the other engine', async () => {
  const f = fixture();
  f.transport.options = vi.fn(async id => { if (id === left.id) throw new Error('Settings unavailable'); return {}; });
  await f.session.start([left, right], root, 1, 1);
  expect(f.states.at(-1)?.options?.[0]).toBeNull();
  expect(f.states.at(-1)?.sides[0].status).toBe('error');
  expect(f.transport.spawn).toHaveBeenCalledTimes(1);
  const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
  f.callbacks.get(id)!('bestmove 7g7f');
  await settle();
  expect(f.states.at(-1)?.busy).toBe(false);
  await f.session.dispose();
});

it.each([{ kind: 'depth' as const, value: 8 }, { kind: 'nodes' as const, value: 100000 }])('sends the same $kind budget to both isolated engines', async budget => {
  const f = fixture();
  await f.session.start([left, right], root, 60, 2, budget);
  for (const [id] of vi.mocked(f.transport.spawn).mock.calls) {
    expect(f.transport.send).toHaveBeenCalledWith(id, `go ${budget.kind} ${budget.value}`);
    expect(f.transport.send).toHaveBeenCalledWith(id, `position sfen ${root}`);
  }
  expect(f.states.at(-1)?.budget).toEqual(budget);
  await f.session.dispose();
});

it('rejects fractional and excessive depth/node budgets before reading settings', async () => {
  const f = fixture();
  for (const budget of [{ kind: 'depth' as const, value: 1.5 }, { kind: 'nodes' as const, value: 0 }, { kind: 'depth' as const, value: 101 }, { kind: 'nodes' as const, value: 1000000001 }]) {
    await f.session.start([left, right], root, 60, 1, budget);
    expect(f.states.at(-1)?.error).toBeTruthy();
  }
  expect(f.transport.options).not.toHaveBeenCalled();
  expect(f.transport.spawn).not.toHaveBeenCalled();
  await f.session.dispose();
});
