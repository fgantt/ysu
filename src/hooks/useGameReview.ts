import { thinkingHistoryStore, thinkingStatus } from '../utils/thinkingHistory';
import { useCallback, useEffect, useRef, useState } from 'react';
import { analysisTransport } from './useAnalysisSession';
import { emptyReview, GameReviewRunner, recordKey, type ReviewRecord, type ReviewState } from '../usi/gameReview';
import type { EngineConfig } from '../types/engine';

const STORAGE_KEY = 'shogi-last-game-review';
export function restoreReview(record: ReviewRecord): ReviewState | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ReviewState | null;
    if (value?.method !== undefined && !['forced', 'adjacent'].includes(value.method)) return null;
    if (value?.version !== 1 || !value.record || !Array.isArray(value.record.moves) || recordKey(value.record) !== recordKey(record) || !Array.isArray(value.rows) || !['complete', 'stopped', 'error'].includes(value.status)) return null;
    if (!Number.isInteger(value.completed) || value.completed < 0 || value.total !== (value.method === 'forced' ? record.moves.length * 2 : record.moves.length + 1) || value.completed > value.total) return null;
    if (!value.rows.every(row => Number.isInteger(row.ply) && row.ply > 0 && row.move === record.moves[row.ply - 1] && ['Sente', 'Gote'].includes(row.side) && typeof row.rootSfen === 'string' && typeof row.afterSfen === 'string' && Array.isArray(row.bestLine) && row.bestLine.every(move => typeof move === 'string') && (row.playedLine === undefined || (Array.isArray(row.playedLine) && row.playedLine.every(move => typeof move === 'string'))) && [row.before, row.after, row.loss].every(score => score === undefined || (typeof score === 'number' && Number.isFinite(score))))) return null;
    return value;
  } catch { return null; }
}
export function useGameReview(record: ReviewRecord, engines: EngineConfig[]) {
  const [state, setState] = useState<ReviewState>(() => restoreReview(record) ?? emptyReview);
  const runner = useRef<GameReviewRunner | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    const current = new GameReviewRunner(analysisTransport, value => {
      stateRef.current = value;
      if (value.search) thinkingHistoryStore.record(value.search, value.engineName ?? 'Review engine', 'review', thinkingStatus(value.status === 'stopped' && !value.search.complete ? 'stopped' : value.searchStatus ?? value.status, value.search));
      setState(value);
    });
    current.restore(stateRef.current);
    runner.current = current;
    return () => {
      runner.current = null;
      const value = stateRef.current;
      if (value.search && !value.search.complete) thinkingHistoryStore.record(value.search, value.engineName ?? 'Review engine', 'review', 'stopped');
      void current.dispose();
    };
  }, []);
  const key = recordKey(record);
  useEffect(() => {
    if (stateRef.current.status === 'idle' && !stateRef.current.record) runner.current?.restore(restoreReview(record) ?? emptyReview);
  }, [key]);
  useEffect(() => {
    if (state.record && ['complete', 'stopped', 'error'].includes(state.status)) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* A full storage quota must not interrupt review. */ }
    }
  }, [state]);
  const start = useCallback((engineId: string, seconds: number, snapshot: ReviewRecord = record) => {
    const engine = engines.find(value => value.id === engineId && value.enabled);
    if (engine) void runner.current?.start(snapshot, engine, seconds, 'forced');
  }, [engines, key]);
  const stop = useCallback(() => { void runner.current?.stop(); }, []);
  return { state, start, stop };
}
