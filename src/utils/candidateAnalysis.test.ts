import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN, Position } from 'tsshogi';
import { candidateScore, parseCandidateLine, parseThinkingMetrics, replayContinuation, updateCandidateSearch, type CandidateSearch } from './candidateAnalysis';

const rootSfen = InitialPositionSFEN.STANDARD;
const search = (): CandidateSearch => ({ engineId: 'engine', rootSfen, complete: false, lines: [] });

describe('candidate analysis', () => {
  it('retains ranked continuations and optional thinking metrics', () => {
    expect(parseCandidateLine('info depth 12 time 500 nodes 1234 nps 2468 multipv 2 score cp -25 upperbound pv 7g7f 3c3d')).toEqual({ rank: 2, depth: 12, time: 500, nodes: 1234, nps: 2468, score: -25, bound: 'upperbound', moves: ['7g7f', '3c3d'] });
  });

  it('ignores free-form info and non-analysis responses', () => {
    expect(parseCandidateLine('info string debug pv 7g7f')).toBeNull();
    expect(parseCandidateLine('bestmove 7g7f')).toBeNull();
    expect(parseCandidateLine('info depth invalid nodes NaN')).toBeNull();
  });

  it('normalizes scores using the searched side and preserves mate scores', () => {
    const goteSfen = rootSfen.replace(' b ', ' w ');
    expect(candidateScore({ rank: 1, moves: [], score: 120 }, goteSfen)).toBe('-120 cp');
    expect(candidateScore({ rank: 1, moves: [], mate: -5 }, goteSfen)).toBe('Sente mate in 5');
    expect(candidateScore({ rank: 1, moves: [], mate: '+' }, rootSfen)).toBe('Sente mate');
    expect(parseCandidateLine('info score mate -5 pv 7g7f')?.mate).toBe(-5);
    expect(parseCandidateLine('info score mate + pv 7g7f')?.mate).toBe('+');
  });

  it('keeps candidates separate by rank and ignores older-depth updates', () => {
    let result = updateCandidateSearch(search(), 'info depth 10 multipv 2 score cp 30 pv 2g2f');
    result = updateCandidateSearch(result, 'info depth 11 multipv 1 score cp 50 pv 7g7f');
    expect(result.lines.map(line => line.rank)).toEqual([1, 2]);
    const old = updateCandidateSearch(result, 'info depth 9 multipv 1 score cp 0 pv 2g2f');
    expect(old).toBe(result);
    result = updateCandidateSearch(result, 'bestmove 7g7f');
    expect(result.complete).toBe(true);
    expect(updateCandidateSearch(result, 'info pv 2g2f')).toBe(result);
    expect(updateCandidateSearch(search(), 'info multipv 1 pv 7g7f').lines).toHaveLength(1);
  });

  it('replays independently and stops at an illegal move without skipping it', () => {
    const main = Position.newBySFEN(rootSfen)!;
    const expected = Position.newBySFEN(rootSfen)!;
    expected.doMove(expected.createMoveByUSI('7g7f')!);
    const preview = replayContinuation(main.sfen, ['7g7f', '3c3d'], 1)!;
    expect(preview.position.sfen).toBe(expected.sfen);
    expect(main.sfen).toBe(rootSfen);
    const broken = replayContinuation(rootSfen, ['7g7f', '7g7f', '3c3d'], 3)!;
    expect(broken.applied).toBe(1);
    expect(broken.invalid).toBe(true);
    expect(replayContinuation('invalid', [], 0)).toBeNull();
  });

  it('replays captures, drops and promotions with correct hands', () => {
    // Two kings and a Sente pawn in hand: legal pawn drop, king reply, promotion.
    const sfen = '4k4/9/9/9/9/9/9/9/4K4 b P 1';
    const result = replayContinuation(sfen, ['P*7c', '5a4a', '7c7b+'], 3)!;
    expect(result.applied).toBe(3);
    expect(result.invalid).toBe(false);
    expect(result.position.sfen).toContain('+P');
    expect(result.position.sfen.split(' ')[2]).toBe('-');
    const capture = replayContinuation('4k4/9/2p6/2R6/9/9/9/9/4K4 b - 1', ['7d7c+'], 1)!;
    expect(capture.applied).toBe(1);
    expect(capture.position.sfen.split(' ')[2]).toBe('P');
  });

  it('retains metrics from packets without PV and ignores free-form debug strings', () => {
    const result = updateCandidateSearch(search(), 'info depth 15 seldepth 20 nodes 4000 nps 8000 time 500 hashfull 250 currmove 7g7f');
    expect(result.lines).toHaveLength(0);
    expect(result.metrics).toEqual({ depth: 15, seldepth: 20, nodes: 4000, nps: 8000, time: 500, hashfull: 250, currentMove: '7g7f' });
    expect(parseThinkingMetrics('info string nodes 999 depth 100')).toEqual({});
    expect(parseThinkingMetrics('info nodes invalid nps -1')).toEqual({});
    expect(updateCandidateSearch(result, 'info depth 10 nodes 3000 time 400').metrics?.nodes).toBe(4000);
  });

});
