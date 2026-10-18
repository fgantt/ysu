import { afterEach, describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { restoreReview } from './useGameReview';
import { emptyReview, forcedReviewRows, reviewPositions, reviewRows } from '../usi/gameReview';
const record = { initialSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f'] };
const positions = reviewPositions(record);
afterEach(() => localStorage.clear());
describe('saved game review', () => {
  it('restores results only for the exact captured game', () => {
    const rows = reviewRows(record, positions.map(rootSfen => ({ engineId: 'engine', rootSfen, complete: true, lines: [{ rank: 1, score: 50, moves: ['7g7f'] }] })));
    const value = { ...emptyReview, status: 'complete', record, completed: 2, total: 2, rows };
    localStorage.setItem('shogi-last-game-review', JSON.stringify(value));
    expect(restoreReview(record)?.rows).toHaveLength(1);
    expect(restoreReview({ ...record, moves: ['2g2f'] })).toBeNull();
  });
  it('ignores malformed or incompatible saved results', () => {
    localStorage.setItem('shogi-last-game-review', JSON.stringify({ ...emptyReview, status: 'complete', record, completed: 2, total: 2, rows: [{ ply: 1, move: '7g7f', bestLine: [] }] }));
    expect(restoreReview(record)).toBeNull();
    localStorage.setItem('shogi-last-game-review', '{invalid');
    expect(restoreReview(record)).toBeNull();
  });
});

it('restores direct-method results while rejecting unknown methods and malformed played lines', () => {
  const searches = [
    { engineId: 'review', rootSfen: record.initialSfen, complete: true, lines: [{ rank: 1, score: 100, moves: ['2g2f'] }] },
    { engineId: 'review', rootSfen: record.initialSfen, complete: true, lines: [{ rank: 1, score: 20, moves: ['7g7f'] }] },
  ];
  const value = { ...emptyReview, status: 'complete', method: 'forced', record, completed: 2, total: 2, rows: forcedReviewRows(record, searches) };
  localStorage.setItem('shogi-last-game-review', JSON.stringify(value));
  expect(restoreReview(record)?.rows[0].loss).toBe(80);
  localStorage.setItem('shogi-last-game-review', JSON.stringify({ ...value, method: 'unknown' }));
  expect(restoreReview(record)).toBeNull();
  localStorage.setItem('shogi-last-game-review', JSON.stringify({ ...value, rows: [{ ...value.rows[0], playedLine: [12] }] }));
  expect(restoreReview(record)).toBeNull();
});
