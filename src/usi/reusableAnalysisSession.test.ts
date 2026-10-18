import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import type { AnalysisState, AnalysisTransport } from './analysisSession';
import { ReusableAnalysisSession } from './reusableAnalysisSession';
const engine: EngineConfig = { id: 'a', name: 'A', display_name: 'A', path: '/engine', enabled: true, is_builtin: false, is_favorite: false, created_at: '', metadata: { name: 'A', options: [{ name: 'MultiPV', option_type: 'spin', min: '1', max: '5', var: [] }, { name: 'Clear Hash', option_type: 'button', var: [] }] } };
const request = { engine, rootSfen: InitialPositionSFEN.STANDARD, candidates: 1, seconds: 1 };
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
function fixture(reuse = true) {
  const callbacks = new Map<string, { message: (message: string) => void; error: (error: string) => void }>();
  const states: AnalysisState[] = [];
  const saved = { EvalFile: '/eval', MultiPV: '1' };
  const transport: AnalysisTransport = {
    options: vi.fn(async () => ({ ...saved })), spawn: vi.fn(async () => {}), terminate: vi.fn(async () => {}),
    listen: vi.fn(async (id, message, error) => { callbacks.set(id, { message, error }); return () => { callbacks.delete(id); }; }),
    send: vi.fn(async (id, command) => { if (command === 'isready') callbacks.get(id)?.message('readyok'); }),
  };
  const session = new ReusableAnalysisSession(transport, value => states.push(value), reuse);
  const finish = async () => { const id = vi.mocked(transport.spawn).mock.calls.at(-1)![0]; callbacks.get(id)!.message('info depth 4 nodes 100 score cp 12 pv 7g7f 3c3d'); callbacks.get(id)!.message('bestmove 7g7f'); await settle(); };
  return { session, transport, callbacks, states, saved, finish };
}
afterEach(() => vi.useRealTimers());
describe('reusable dedicated analysis', () => {
  it('reuses only the matching owned engine, resets the root and metrics, and gives each search a separate history ID', async () => {
    const f = fixture();
    await f.session.start(request);
    await f.finish();
    const first = f.states.at(-1)!;
    expect(first.engineReady).toBe(true);
    expect(f.transport.terminate).not.toHaveBeenCalled();
    const nextRoot = request.rootSfen.replace(' b ', ' w ');
    await f.session.start({ ...request, rootSfen: nextRoot });
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    const state = f.states.at(-1)!;
    expect(state.reused).toBe(true);
    expect(state.search?.engineId).not.toBe(first.search?.engineId);
    expect(state.search?.rootSfen).toBe(nextRoot);
    expect(state.search?.lines).toEqual([]);
    expect(state.search?.metrics).toBeUndefined();
    const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
    expect(f.transport.send).toHaveBeenCalledWith(id, 'setoption name Clear Hash');
    expect(f.transport.send).toHaveBeenCalledWith(id, `position sfen ${nextRoot}`);
    await f.session.stop();
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.callbacks.size).toBe(0);
    await f.session.dispose();
  });
  it.each(['candidates', 'options', 'path', 'metadata'] as const)('restarts when %s changes', async change => {
    const f = fixture();
    await f.session.start(request);
    await f.finish();
    const next = { ...request, engine: structuredClone(engine) };
    if (change === 'candidates') next.candidates = 2;
    if (change === 'options') f.saved.EvalFile = '/other-eval';
    if (change === 'path') next.engine.path = '/other-engine';
    if (change === 'metadata') next.engine.metadata!.options.push({ name: 'Extra', option_type: 'check', var: [] });
    await f.session.start(next);
    expect(f.transport.spawn).toHaveBeenCalledTimes(2);
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.states.at(-1)?.reused).toBe(false);
    expect(f.saved.MultiPV).toBe('1');
    await f.session.dispose();
    expect(f.callbacks.size).toBe(0);
  });
  it('ignores idle and pre-ready packets before searching the new root', async () => {
    const f = fixture();
    await f.session.start(request);
    await f.finish();
    const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
    f.callbacks.get(id)!.message('info depth 99 pv 2g2f');
    f.transport.send = vi.fn(async (target, command) => {
      if (command === 'isready') { f.callbacks.get(target)!.message('info depth 88 pv 2g2f'); f.callbacks.get(target)!.message('bestmove 2g2f'); f.callbacks.get(target)!.message('readyok'); }
    });
    await f.session.start(request);
    expect(f.states.at(-1)?.status).toBe('running');
    expect(f.states.at(-1)?.search?.lines).toEqual([]);
    await f.session.dispose();
  });
  it('releases an idle engine after two minutes and when reuse is disabled', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.session.start(request);
    await f.finish();
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.states.at(-1)?.engineReady).toBe(false);
    await f.session.start(request);
    await f.finish();
    await f.session.setReuse(false);
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    expect(f.states.at(-1)?.reuseEnabled).toBe(false);
    await f.session.dispose();
  });
  it('cancels during a readiness barrier and retires the process without searching', async () => {
    const f = fixture();
    f.transport.send = vi.fn(async () => {});
    const starting = f.session.start(request);
    await settle();
    await f.session.stop();
    await starting;
    expect(f.transport.send).not.toHaveBeenCalledWith(expect.anything(), 'go movetime 1000');
    expect(f.states.at(-1)?.status).toBe('stopped');
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.callbacks.size).toBe(0);
    await f.session.dispose();
  });
  it('retires an engine that times out or dies and starts a fresh process on retry', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.transport.send = vi.fn(async () => {});
    const starting = f.session.start(request);
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    await starting;
    expect(f.states.at(-1)?.error).toContain('readiness timed out');
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    f.transport.send = vi.fn(async (id, command) => { if (command === 'isready') f.callbacks.get(id)!.message('readyok'); });
    await f.session.start(request);
    const id = vi.mocked(f.transport.spawn).mock.calls.at(-1)![0];
    f.callbacks.get(id)!.error('Engine process died');
    await settle();
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    await f.session.dispose();
  });
  it('closes retained engines on clear/dispose and keeps the default fresh-process behavior', async () => {
    const f = fixture();
    await f.session.start(request); await f.finish(); await f.session.clear();
    expect(f.states.at(-1)?.status).toBe('idle');
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    await f.session.start(request); await f.finish(); await f.session.dispose();
    expect(f.transport.terminate).toHaveBeenCalledTimes(2);
    const fresh = fixture(false);
    await fresh.session.start(request); await fresh.finish(); await fresh.session.start(request); await fresh.finish();
    expect(fresh.transport.spawn).toHaveBeenCalledTimes(2);
    expect(fresh.transport.terminate).toHaveBeenCalledTimes(2);
    await fresh.session.dispose();
  });
  it('does not start overlapping requests and does not retain failed restricted searches', async () => {
    const f = fixture();
    await Promise.all([f.session.start({ ...request, searchMoves: ['2g2f'] }), f.session.start(request)]);
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    await f.finish();
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.states.at(-1)?.engineReady).toBe(false);
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    await f.session.dispose();
  });
});

it('retires a stalled search instead of keeping it warm', async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.session.start(request);
  await vi.advanceTimersByTimeAsync(6000);
  expect(f.states.at(-1)?.status).toBe('error');
  expect(f.states.at(-1)?.engineRetained).toBe(false);
  expect(f.transport.terminate).toHaveBeenCalledOnce();
  expect(f.callbacks.size).toBe(0);
  await f.session.dispose();
});

it('handles an idle engine dying and retries with a new process', async () => {
  const f = fixture();
  await f.session.start(request); await f.finish();
  const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
  f.callbacks.get(id)!.error('Engine process died');
  await settle();
  expect(f.states.at(-1)?.engineReady).toBe(false);
  expect(f.transport.terminate).toHaveBeenCalledOnce();
  await f.session.start(request);
  expect(f.transport.spawn).toHaveBeenCalledTimes(2);
  expect(f.states.at(-1)?.reused).toBe(false);
  await f.session.dispose();
});

it('cancels a reused engine during readiness and starts no new search', async () => {
  const f = fixture();
  await f.session.start(request); await f.finish();
  f.transport.send = vi.fn(async () => {});
  const starting = f.session.start(request);
  await settle();
  await f.session.stop(); await starting;
  expect(f.transport.spawn).toHaveBeenCalledOnce();
  expect(f.transport.send).not.toHaveBeenCalledWith(expect.anything(), 'go movetime 1000');
  expect(f.transport.terminate).toHaveBeenCalledOnce();
  expect(f.states.at(-1)?.engineRetained).toBe(false);
  await f.session.dispose();
});

it('does not spawn a replacement after cancellation while retiring an old configuration', async () => {
  const f = fixture();
  await f.session.start(request); await f.finish();
  let release!: () => void;
  f.transport.terminate = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
  const starting = f.session.start({ ...request, candidates: 2 });
  await settle();
  const stopping = f.session.stop();
  release();
  await Promise.all([starting, stopping]);
  expect(f.transport.spawn).toHaveBeenCalledOnce();
  expect(f.states.at(-1)?.status).toBe('stopped');
  await f.session.dispose();
});

it('closes the previous warm engine when cancelled while reading new settings', async () => {
  const f = fixture();
  await f.session.start(request); await f.finish();
  let resolve!: (options: Record<string, string>) => void;
  f.transport.options = vi.fn(() => new Promise<Record<string, string>>(done => { resolve = done; }));
  const starting = f.session.start(request);
  await settle();
  const stopping = f.session.stop();
  resolve({});
  await Promise.all([starting, stopping]);
  expect(f.transport.spawn).toHaveBeenCalledOnce();
  expect(f.transport.terminate).toHaveBeenCalledOnce();
  expect(f.states.at(-1)?.engineRetained).toBe(false);
  await f.session.dispose();
});

it('retains ownership after a cleanup failure so explicit close can retry', async () => {
  const f = fixture();
  await f.session.start(request); await f.finish();
  vi.mocked(f.transport.terminate).mockRejectedValueOnce(new Error('Temporary cleanup failure'));
  await f.session.releaseEngine();
  expect(f.states.at(-1)?.status).toBe('error');
  expect(f.states.at(-1)?.engineRetained).toBe(true);
  expect(f.states.at(-1)?.engineReady).toBe(false);
  await f.session.releaseEngine();
  expect(f.transport.terminate).toHaveBeenCalledTimes(2);
  expect(f.states.at(-1)?.engineRetained).toBe(false);
  await f.session.dispose();
});
