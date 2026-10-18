import { thinkingHistoryStore, thinkingStatus } from '../utils/thinkingHistory';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineConfig } from '../types/engine';
import { EngineComparisonSession, emptyComparison, type ComparisonAction } from '../usi/engineComparison';
import { restoreComparison, saveComparison } from '../utils/comparisonCache';
import { analysisTransport } from './useAnalysisSession';

export function useEngineComparison(engines: EngineConfig[], rootSfen: string) {
  const [state, setState] = useState(() => restoreComparison() ?? emptyComparison());
  const initialState = useRef(state);
  const latest = useRef(state);
  const session = useRef<EngineComparisonSession | null>(null);
  useEffect(() => {
    const capture = (value: typeof state) => {
      latest.current = value;
      value.sides.forEach((side, index) => { if (side.search) thinkingHistoryStore.record(side.search, value.engines?.[index].name ?? 'Comparison engine', 'comparison', thinkingStatus(side.status, side.search)); });
      setState(value);
    };
    const current = new EngineComparisonSession(analysisTransport, capture, initialState.current);
    capture(initialState.current);
    session.current = current;
    return () => {
      session.current = null;
      latest.current.sides.forEach((side, index) => { if (side.search && !side.search.complete) thinkingHistoryStore.record(side.search, latest.current.engines?.[index].name ?? 'Comparison engine', 'comparison', 'stopped'); });
      void current.dispose();
    };
  }, []);
  useEffect(() => { saveComparison(state); }, [state]);
  const onAction = useCallback((action: ComparisonAction) => {
    if (action.type === 'comparison-stop') void session.current?.stop();
    else {
      const left = engines.find(engine => engine.id === action.engineIds[0] && engine.enabled);
      const right = engines.find(engine => engine.id === action.engineIds[1] && engine.enabled);
      if (left && right) void session.current?.start([left, right], rootSfen, action.seconds, action.candidates, action.budget);
    }
  }, [engines, rootSfen]);
  return { state, onAction };
}
