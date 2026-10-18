import { Position } from 'tsshogi';
import type { ComparisonState } from '../usi/engineComparison';
import { validSearchBudget } from '../usi/searchBudget';

export const COMPARISON_STORAGE_KEY = 'shogi-last-engine-comparison';
const text = (value: unknown) => typeof value === 'string' && value.length <= 4096;
const number = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value);

/** Restore data only, never engine processes. Reject mismatched roots and illegal continuations. */
export function parseComparisonCache(raw: string): ComparisonState | null {
  if (raw.length > 2_000_000) return null;
  try {
    const state = JSON.parse(raw) as ComparisonState;
    if (state.version !== 1 || state.busy !== false || !text(state.rootSfen) || !Position.newBySFEN(state.rootSfen!)
      || !number(state.seconds) || state.seconds! < 1 || state.seconds! > 60
      || !number(state.candidates) || state.candidates! < 1 || state.candidates! > 5
      || (state.budget !== undefined && !validSearchBudget(state.budget))
      || !Array.isArray(state.engines) || state.engines.length !== 2 || state.engines.some(engine => !text(engine.id) || !text(engine.name))
      || state.engines[0].id === state.engines[1].id
      || !Array.isArray(state.sides) || state.sides.length !== 2
      || (state.error !== undefined && !text(state.error))) return null;
    if (state.options !== undefined && (!Array.isArray(state.options) || state.options.length !== 2 || state.options.some(options => options !== null && (typeof options !== 'object' || Array.isArray(options) || Object.entries(options).length > 256 || !Object.entries(options).every(([key, value]) => text(key) && text(value)))))) return null;
    for (const side of state.sides) {
      if (!['complete', 'stopped', 'error'].includes(side.status) || [side.engineName, side.error, side.diagnostic].some(value => value !== undefined && !text(value))) return null;
      if (!side.search) continue;
      const search = side.search;
      if (search.rootSfen !== state.rootSfen || !text(search.engineId) || search.complete !== true || !Array.isArray(search.lines) || search.lines.length > 5) return null;
      const ranks = new Set<number>();
      for (const line of search.lines) {
        if (!number(line.rank) || line.rank < 1 || line.rank > state.candidates! || ranks.has(line.rank) || !Array.isArray(line.moves) || !line.moves.length || line.moves.length > 256
          || [line.score, line.depth, line.nodes, line.nps, line.time].some(value => value !== undefined && !number(value))
          || (line.mate !== undefined && !number(line.mate) && line.mate !== '+' && line.mate !== '-')
          || (line.bound !== undefined && !['lowerbound', 'upperbound'].includes(line.bound))) return null;
        ranks.add(line.rank);
        const position = Position.newBySFEN(state.rootSfen!)!;
        for (const usi of line.moves) {
          if (!text(usi)) return null;
          const move = position.createMoveByUSI(usi);
          if (!move || move.usi !== usi || !position.isValidMove(move) || !position.doMove(move)) return null;
        }
      }
      if (search.metrics && (typeof search.metrics !== 'object' || Object.entries(search.metrics).some(([key, value]) => key === 'currentMove' ? !text(value) : !['depth', 'seldepth', 'nodes', 'nps', 'time', 'hashfull'].includes(key) || !number(value) || value < 0))) return null;
    }
    return { ...state, restored: true };
  } catch { return null; }
}
export function restoreComparison(): ComparisonState | null {
  try { const raw = localStorage.getItem(COMPARISON_STORAGE_KEY); return raw ? parseComparisonCache(raw) : null; }
  catch { return null; }
}
export function saveComparison(state: ComparisonState) {
  if (!state.rootSfen || state.busy || state.restored) return;
  try {
    const raw = JSON.stringify(state);
    if (parseComparisonCache(raw)) localStorage.setItem(COMPARISON_STORAGE_KEY, raw);
  }
  catch { /* Storage quota must not interrupt engine searches. */ }
}
