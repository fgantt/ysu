import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineConfig } from '../types/engine';
import { MateSearchSession, type MateSearchState, type MateSearchAction, type MateCapability } from '../usi/mateSearchSession';
import { analysisTransport } from './useAnalysisSession';
export function useMateSearch(engines: EngineConfig[], rootSfen: string) {
  const [state, setState] = useState<MateSearchState>({ status: 'idle' });
  const [capabilities, setCapabilities] = useState<Record<string, MateCapability>>({});
  const session = useRef<MateSearchSession | null>(null);
  useEffect(() => {
    const current = new MateSearchSession(analysisTransport, next => {
      setState(next);
      if (next.engineId && next.capability && next.capability !== 'unverified') setCapabilities(previous => ({ ...previous, [next.engineId!]: next.capability! }));
    });
    session.current = current;
    return () => { session.current = null; void current.dispose(); };
  }, []);
  const onAction = useCallback((action: MateSearchAction) => {
    if (action.type === 'mate-stop') void session.current?.stop();
    else { const engine = engines.find(item => item.id === action.engineId && item.enabled); if (engine) void session.current?.start({ engine, rootSfen: action.rootSfen ?? rootSfen, seconds: action.seconds }); }
  }, [engines, rootSfen]);
  return { state, capabilities, onAction };
}
