import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineConfig } from '../types/engine';
import type { AnalysisTransport } from './analysisSession';
import { MateSearchSession, type MateSearchState } from './mateSearchSession';
const root = '4k4/9/4G4/9/9/9/9/9/4K4 b G 1';
const engine: EngineConfig = { id: 'mate-engine', name: 'Engine', display_name: 'Mate engine', path: '/engine', enabled: true, is_builtin: false, is_favorite: false, created_at: '', metadata: { name: 'Engine', options: [{ name: 'MultiPV', option_type: 'spin', min: '1', max: '5', var: [] }] } };
const request = { engine, rootSfen: root, seconds: 1 };
function fixture() {
  let message: (value: string) => void = () => {};
  let error: (value: string) => void = () => {};
  const states: MateSearchState[] = [];
  const unlisten = vi.fn();
  const saved = { MultiPV: '5', EvalFile: '/eval' };
  const transport: AnalysisTransport = { listen: vi.fn(async (_id, onMessage, onError) => { message = onMessage; error = onError; return unlisten; }), options: vi.fn(async () => saved), spawn: vi.fn(async () => {}), send: vi.fn(async () => {}), terminate: vi.fn(async () => {}) };
  return { session: new MateSearchSession(transport, state => states.push(state)), transport, states, saved, unlisten, message: (value: string) => message(value), error: (value: string) => error(value) };
}
async function settle() { for (let index = 0; index < 16; index++) await Promise.resolve(); }
afterEach(() => vi.useRealTimers());
describe('isolated mate-search lifecycle', () => {
  it('sends go mate on the exact root, validates the reply and cleans up its own process', async () => {
    const f = fixture();
    await f.session.start(request);
    const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
    expect(id).toMatch(/^mate-/);
    expect(id).not.toBe(engine.id);
    expect(f.transport.send).toHaveBeenCalledWith(id, `position sfen ${root}`);
    expect(f.transport.send).toHaveBeenCalledWith(id, 'go mate 1000');
    expect(f.saved.MultiPV).toBe('5');
    f.message('info depth 4 nodes 42 score mate 1 pv G*5b');
    expect(f.states.at(-1)?.status).toBe('running');
    expect(f.states.at(-1)?.metrics?.nodes).toBe(42);
    f.message('checkmate G*5b');
    await settle();
    expect(f.states.at(-1)?.status).toBe('found');
    expect(f.states.at(-1)?.moves).toEqual(['G*5b']);
    expect(f.states.at(-1)?.capability).toBe('responded');
    expect(f.transport.terminate).toHaveBeenCalledWith(id);
    expect(f.unlisten).toHaveBeenCalledOnce();
    await f.session.dispose();
  });
  it.each([['checkmate nomate', 'nomate', 'responded'], ['checkmate timeout', 'timeout', 'responded'], ['checkmate notimplemented', 'unsupported', 'unsupported'], ['bestmove G*5b', 'unsupported', 'unsupported']])('handles %s distinctly', async (reply, status, capability) => {
    const f = fixture(); await f.session.start(request); f.message(reply); await settle();
    expect(f.states.at(-1)?.status).toBe(status); expect(f.states.at(-1)?.capability).toBe(capability);
    expect(f.transport.terminate).toHaveBeenCalledOnce(); await f.session.dispose();
  });
  it('rejects invalid reported lines and never offers them as mate', async () => {
    const f = fixture(); await f.session.start(request); f.message('checkmate 5c5b'); await settle();
    expect(f.states.at(-1)?.status).toBe('error'); expect(f.states.at(-1)?.moves).toBeUndefined();
    expect(f.transport.terminate).toHaveBeenCalledOnce(); await f.session.dispose();
  });
  it('times out silence without claiming unsupported capability', async () => {
    vi.useFakeTimers(); const f = fixture(); await f.session.start(request);
    await vi.advanceTimersByTimeAsync(6000);
    expect(f.states.at(-1)?.status).toBe('timeout'); expect(f.states.at(-1)?.capability).toBe('unverified');
    expect(f.transport.terminate).toHaveBeenCalledOnce(); await f.session.dispose();
  });
  it('stops during startup without submitting a search', async () => {
    const f = fixture(); let resolve!: () => void;
    f.transport.spawn = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const start = f.session.start(request); await settle(); const stop = f.session.stop(); resolve(); await Promise.all([start, stop]);
    expect(f.transport.send).not.toHaveBeenCalled(); expect(f.states.at(-1)?.status).toBe('stopped');
    expect(f.transport.terminate).toHaveBeenCalledOnce(); await f.session.dispose();
  });
  it('stops active searches, rejects late replies and uses new IDs on a fresh run', async () => {
    const f = fixture(); await f.session.start(request); const id = vi.mocked(f.transport.spawn).mock.calls[0][0];
    await f.session.stop(); expect(f.transport.send).toHaveBeenCalledWith(id, 'stop');
    const count = f.states.length; f.message('checkmate G*5b'); expect(f.states).toHaveLength(count);
    await f.session.start(request); expect(vi.mocked(f.transport.spawn).mock.calls[1][0]).not.toBe(id);
    await f.session.dispose(); expect(f.transport.terminate).toHaveBeenCalledTimes(2);
  });
  it('keeps stderr diagnostic messages nonfatal and cleans up initialization failure', async () => {
    const f = fixture(); await f.session.start(request); f.error('Loading evaluation data');
    expect(f.states.at(-1)?.status).toBe('running'); await f.session.stop();
    f.transport.spawn = vi.fn(async () => { throw new Error('Initialization failed'); });
    await f.session.start(request); expect(f.states.at(-1)?.status).toBe('error');
    expect(f.transport.terminate).toHaveBeenCalledTimes(2); await f.session.dispose();
  });
});

it('rejects invalid positions or budgets before starting a process', async () => {
  const f = fixture(); await f.session.start({ ...request, rootSfen: 'invalid' });
  expect(f.states.at(-1)?.status).toBe('error');
  await f.session.start({ ...request, seconds: 0 });
  expect(f.transport.spawn).not.toHaveBeenCalled(); await f.session.dispose();
});
