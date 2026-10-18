import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import type { CandidateSearch } from '../utils/candidateAnalysis';
import type { EngineConfig } from '../types/engine';
import type { AnalysisTransport } from './analysisSession';
import { forcedReviewRows, GameReviewRunner, reviewPositions, reviewRows, senteScore, type ReviewState } from './gameReview';

const record = { initialSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f', '3c3d'] };
const positions = reviewPositions(record);
const search = (index: number, score: number): CandidateSearch => ({ engineId: 'review', rootSfen: positions[index], complete: true, lines: [{ rank: 1, score, moves: index === 0 ? ['2g2f'] : ['8c8d'] }] });
const engine: EngineConfig = { id: 'engine', name: 'Engine', display_name: 'Engine', path: '/engine', enabled: true, is_builtin: false, created_at: '', is_favorite: false };
async function settle() { for (let index = 0; index < 30; index++) await Promise.resolve(); }
afterEach(() => vi.useRealTimers());

function fixture(auto = true) {
  const callbacks = new Map<string, (message: string) => void>();
  const states: ReviewState[] = [];
  const saved = { Setting: 'original' };
  const transport: AnalysisTransport = {
    listen: vi.fn(async (id, onMessage) => { callbacks.set(id, onMessage); return () => callbacks.delete(id); }),
    options: vi.fn(async () => ({ ...saved })),
    spawn: vi.fn(async () => {}), terminate: vi.fn(async () => {}),
    send: vi.fn(async (id, command) => {
      if (auto && command.startsWith('go ')) {
        callbacks.get(id)?.('info depth 8 score cp 100 pv 7g7f');
        callbacks.get(id)?.('bestmove 7g7f');
        saved.Setting = 'changed while reviewing';
      }
    }),
  };
  return { runner: new GameReviewRunner(transport, state => states.push(state)), transport, states, callbacks };
}

describe('game review', () => {
  it('reconstructs every historical position without altering the captured record', () => {
    expect(positions).toHaveLength(3);
    expect(positions[1].split(' ')[1]).toBe('w');
    expect(record.moves).toEqual(['7g7f', '3c3d']);
    expect(() => reviewPositions({ ...record, moves: ['7g7f', '7g7f'] })).toThrow('Move 2');
  });
  it('normalizes Gote scores and flags estimated losses for the player who moved', () => {
    const rows = reviewRows(record, [search(0, 100), search(1, 200), search(2, 100)]);
    expect(rows[0].loss).toBe(300);
    expect(rows[0].side).toBe('Sente');
    expect(rows[1].loss).toBe(300);
    expect(rows[1].side).toBe('Gote');
  });
  it('does not label bounded, missing or mate scores as centipawn losses', () => {
    const first = search(0, 100);
    first.lines[0].bound = 'lowerbound';
    expect(senteScore(first)).toBeUndefined();
    expect(reviewRows(record, [first, search(1, 200)])[0].loss).toBeUndefined();
    first.lines[0].bound = undefined;
    first.lines[0].mate = 5;
    expect(senteScore(first)).toBeUndefined();
  });
  it('reviews all positions sequentially with a frozen settings snapshot and equal budgets', async () => {
    const f = fixture();
    await f.runner.start(record, engine, 1);
    expect(f.states.at(-1)?.status).toBe('complete');
    expect(f.states.at(-1)?.completed).toBe(3);
    expect(f.states.at(-1)?.rows).toHaveLength(2);
    expect(f.transport.options).toHaveBeenCalledOnce();
    expect(f.transport.spawn).toHaveBeenCalledTimes(3);
    for (const [, , options] of vi.mocked(f.transport.spawn).mock.calls) expect(options.Setting).toBe('original');
    expect(vi.mocked(f.transport.send).mock.calls.filter(([, command]) => command.startsWith('go ')).map(([, command]) => command)).toEqual(['go movetime 1000', 'go movetime 1000', 'go movetime 1000']);
    expect(f.transport.terminate).toHaveBeenCalledTimes(3);
    expect(f.callbacks.size).toBe(0);
  });
  it('cancels the current position and never starts the remaining positions', async () => {
    const f = fixture(false);
    const task = f.runner.start(record, engine, 1);
    await settle();
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    await f.runner.stop();
    await task;
    expect(f.states.at(-1)?.status).toBe('stopped');
    expect(f.transport.spawn).toHaveBeenCalledOnce();
    expect(f.transport.terminate).toHaveBeenCalledOnce();
    expect(f.callbacks.size).toBe(0);
  });
  it('retains completed results when a later position fails', async () => {
    const f = fixture();
    vi.mocked(f.transport.spawn).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('engine failure'));
    await f.runner.start(record, engine, 1);
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.states.at(-1)?.rows).toHaveLength(1);
    expect(f.states.at(-1)?.error).toContain('engine failure');
    expect(f.callbacks.size).toBe(0);
  });
});

describe('direct same-root review', () => {
  it('pairs normal and restricted searches at identical roots with equal budgets', async () => {
    const f = fixture();
    const roots = new Map<string, string>();
    vi.mocked(f.transport.send).mockImplementation(async (id, command) => {
      if (command.startsWith('position sfen ')) roots.set(id, command.slice(14));
      if (command.startsWith('go ')) {
        const forced = command.split(' searchmoves ')[1];
        const white = roots.get(id)?.includes(' w ');
        const move = forced ?? (white ? '8c8d' : '2g2f');
        f.callbacks.get(id)?.(`info depth 8 score cp ${forced ? 20 : 100} pv ${move}`);
        f.callbacks.get(id)?.(`bestmove ${move}`);
      }
    });
    await f.runner.start(record, engine, 1, 'forced');
    const result = f.states.at(-1)!;
    expect(result.status).toBe('complete');
    expect(result.completed).toBe(4);
    expect(result.total).toBe(4);
    expect(result.rows.map(row => row.loss)).toEqual([80, 80]);
    expect(result.rows[1].before).toBe(-100);
    expect(result.rows[1].after).toBe(-20);
    const commands = vi.mocked(f.transport.send).mock.calls.map(([, command]) => command);
    expect(commands.filter(command => command.startsWith('position'))).toEqual([`position sfen ${positions[0]}`, `position sfen ${positions[0]}`, `position sfen ${positions[1]}`, `position sfen ${positions[1]}`]);
    expect(commands.filter(command => command.startsWith('go '))).toEqual(['go movetime 1000', 'go movetime 1000 searchmoves 7g7f', 'go movetime 1000', 'go movetime 1000 searchmoves 3c3d']);
    expect(f.transport.options).toHaveBeenCalledOnce();
    expect(f.transport.terminate).toHaveBeenCalledTimes(4);
    expect(f.callbacks.size).toBe(0);
  });
  it('rejects an engine that ignores the restricted move rather than reporting a loss', async () => {
    const f = fixture();
    await f.runner.start({ ...record, moves: ['2g2f'] }, engine, 1, 'forced');
    expect(f.states.at(-1)?.status).toBe('error');
    expect(f.states.at(-1)?.error).toContain('did not honor');
    expect(f.states.at(-1)?.rows).toEqual([]);
    expect(f.callbacks.size).toBe(0);
  });
  it('does not invent loss scores for missing, bounded, mate or mismatched PV data', () => {
    const best = search(0, 100), played = { ...search(0, 20), lines: [{ rank: 1, score: 20, moves: ['7g7f'] }] };
    expect(forcedReviewRows(record, [best, played])[0].loss).toBe(80);
    played.lines[0].moves = [];
    expect(forcedReviewRows(record, [best, played])[0].loss).toBeUndefined();
    played.lines[0].moves = ['2g2f'];
    expect(() => forcedReviewRows(record, [best, played])).toThrow('different restricted move');
    played.lines[0].moves = ['7g7f']; best.lines[0].mate = 3;
    expect(forcedReviewRows(record, [best, played])[0].loss).toBeUndefined();
  });
  it('cancels the second search without treating an incomplete pair as a reviewed move', async () => {
    const f = fixture(false);
    const task = f.runner.start(record, engine, 1, 'forced');
    await settle();
    const id = [...f.callbacks.keys()][0];
    f.callbacks.get(id)?.('info score cp 100 pv 2g2f'); f.callbacks.get(id)?.('bestmove 2g2f');
    await settle();
    expect(f.transport.spawn).toHaveBeenCalledTimes(2);
    await f.runner.stop(); await task;
    expect(f.states.at(-1)?.status).toBe('stopped');
    expect(f.states.at(-1)?.completed).toBe(1);
    expect(f.states.at(-1)?.rows).toEqual([]);
    expect(f.callbacks.size).toBe(0);
  });
});
