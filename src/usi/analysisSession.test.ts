import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { AnalysisSession, maxCandidates, type AnalysisState, type AnalysisTransport } from './analysisSession';
import type { EngineConfig } from '../types/engine';

const engine: EngineConfig = {
  id: 'configured-engine', name: 'Engine', display_name: 'Analysis Engine', path: '/engine', enabled: true, is_builtin: false, created_at: '', is_favorite: false,
  metadata: { name: 'Engine', options: [
    { name: 'MultiPV', option_type: 'spin', min: '1', max: '500', var: [] },
    { name: 'Threads', option_type: 'spin', min: '1', max: '32', var: [] },
    { name: 'USI_Hash', option_type: 'spin', min: '1', max: '1024', var: [] },
  ] },
};
const request = { engine, rootSfen: InitialPositionSFEN.STANDARD, candidates: 3, seconds: 5 };
function fixture() {
  let message: (message: string) => void = () => {};
  let diagnostic: (error: string) => void = () => {};
  const states: AnalysisState[] = [];
  const unlisten = vi.fn();
  const saved = { EvalFile: '/evaluation', MultiPV: '1' };
  const transport: AnalysisTransport = {
    listen: vi.fn(async (_id, onMessage, onError) => { message = onMessage; diagnostic = onError; return unlisten; }),
    options: vi.fn(async () => saved),
    spawn: vi.fn(async () => {}), send: vi.fn(async () => {}), terminate: vi.fn(async () => {}),
  };
  return { session: new AnalysisSession(transport, state => states.push(state)), transport, states, unlisten, saved, message: (value: string) => message(value), diagnostic: (value: string) => diagnostic(value) };
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
afterEach(() => vi.useRealTimers());

describe('dedicated analysis session', () => {
  it('uses a unique process, exact root and temporary options without changing saved options', async () => {
    const f = fixture();
    await f.session.start(request);
    const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
    expect(id).toMatch(/^analysis-/);
    expect(id).not.toBe(engine.id);
    expect(f.transport.spawn).toHaveBeenCalledWith(id, engine, { EvalFile: '/evaluation', MultiPV: '3', Threads: '2', USI_Hash: '128' });
    expect(f.saved.MultiPV).toBe('1');
    expect(f.transport.send).toHaveBeenNthCalledWith(1, id, 'usinewgame');
    expect(f.transport.send).toHaveBeenNthCalledWith(2, id, `position sfen ${request.rootSfen}`);
    expect(f.transport.send).toHaveBeenNthCalledWith(3, id, 'go movetime 5000');
    f.message('info depth 12 multipv 2 score cp 80 pv 2g2f 8c8d');
    expect(f.states.at(-1)?.search?.lines[0].rank).toBe(2);
    f.message('bestmove 7g7f');
    await settle();
    expect(f.transport.terminate).toHaveBeenCalledWith(id);
    expect(f.unlisten).toHaveBeenCalledOnce();
    expect(f.states.at(-1)?.status).toBe('complete');
    expect(f.states.at(-1)?.search?.lines).toHaveLength(1);
  });

  it('stops an active search, ignores late results, and can start a fresh request', async () => {
    const f = fixture();
    await f.session.start(request);
    f.message('info pv 7g7f');
    await f.session.stop();
    expect(f.states.at(-1)?.status).toBe('stopped');
    const count = f.states.length;
    f.message('info pv 2g2f');
    expect(f.states).toHaveLength(count);
    await f.session.start({ ...request, candidates: 1 });
    expect(f.transport.spawn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(f.transport.spawn).mock.calls[0][0]).not.toBe(vi.mocked(f.transport.spawn).mock.calls[1][0]);
    await f.session.dispose();
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
  });

  it('cancels during startup without sending a search or leaking the engine', async () => {
    const f = fixture();
    let completeSpawn!: () => void;
    vi.mocked(f.transport.spawn).mockImplementation(() => new Promise(resolve => { completeSpawn = resolve; }));
    const starting = f.session.start(request);
    await settle();
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    const stopping = f.session.stop();
    completeSpawn();
    await starting;
    await stopping;
    expect(f.transport.send).not.toHaveBeenCalled();
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.states.at(-1)?.status).toBe('stopped');
  });

  it('cleans up failed initialization and reports the failure', async () => {
    const f = fixture();
    vi.mocked(f.transport.spawn).mockRejectedValueOnce(new Error('readyok timeout'));
    await f.session.start(request);
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.states.at(-1)?.error).toContain('readyok timeout');
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.unlisten).toHaveBeenCalledOnce();
  });

  it('does not start unsupported candidate counts or overlapping searches', async () => {
    const f = fixture();
    const single = { ...engine, metadata: { name: 'Single', options: [] } };
    expect(maxCandidates(single)).toBe(1);
    await f.session.start({ ...request, engine: single });
    expect(f.transport.spawn).not.toHaveBeenCalled();
    await f.session.start(request);
    await f.session.start(request);
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    await f.session.dispose();
  });

  it('terminates engines that fail to complete their search', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.session.start(request);
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.states.at(-1)?.error).toContain('time limit');
  });

  it('preserves ordinary stderr diagnostics without aborting a search', async () => {
    const f = fixture();
    await f.session.start(request);
    f.diagnostic('Loading evaluation weights');
    expect(f.states.at(-1)?.status).toBe('running');
    expect(f.states.at(-1)?.diagnostic).toBe('Loading evaluation weights');
    expect(f.transport.terminate).not.toHaveBeenCalled();
    f.message('bestmove 7g7f');
    await settle();
    expect(f.states.at(-1)?.status).toBe('complete');
  });

});

it('retains partial results and retires a depth search at the safety limit', async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.session.start({ ...request, budget: { kind: 'depth', value: 20 } });
  f.message('info depth 8 score cp 30 pv 7g7f 3c3d');
  await vi.advanceTimersByTimeAsync(59999);
  expect(f.states.at(-1)?.status).toBe('running');
  await vi.advanceTimersByTimeAsync(1);
  expect(f.states.at(-1)?.status).toBe('error');
  expect(f.states.at(-1)?.error).toContain('60-second safety limit');
  expect(f.states.at(-1)?.search?.lines[0].score).toBe(30);
  expect(f.states.at(-1)?.search?.complete).toBe(true);
  expect(f.transport.terminate).toHaveBeenCalledOnce();
  expect(f.unlisten).toHaveBeenCalledOnce();
});
