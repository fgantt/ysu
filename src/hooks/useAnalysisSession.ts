import { ReusableAnalysisSession } from '../usi/reusableAnalysisSession';
import { thinkingHistoryStore, thinkingStatus } from '../utils/thinkingHistory';
import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AnalysisAction, AnalysisState, AnalysisTransport } from '../usi/analysisSession';
import type { CommandResponse, EngineConfig } from '../types/engine';

async function command<T>(name: string, args: Record<string, unknown>): Promise<T | undefined> {
  const result = await invoke<CommandResponse<T>>(name, args);
  if (!result.success) throw new Error(result.message || `${name} failed`);
  return result.data;
}
export const analysisTransport: AnalysisTransport = {
  listen: async (id, onMessage, onError) => {
    const unlistenMessage = await listen<string>(`usi-message::${id}`, event => onMessage(event.payload));
    try {
      const unlistenError = await listen<string>(`usi-error::${id}`, event => onError(event.payload));
      return () => { unlistenMessage(); unlistenError(); };
    } catch (error) { unlistenMessage(); throw error; }
  },
  options: async engineId => await command<Record<string, string>>('get_engine_options', { engineId }) ?? {},
  spawn: async (engineId, engine, tempOptions) => { await command('spawn_engine', { engineId, name: engine.name, path: engine.path, tempOptions }); },
  send: async (engineId, value) => { await command('send_usi_command', { engineId, command: value }); },
  terminate: async engineId => {
    try { await command('stop_engine', { engineId }); }
    catch (error) {
      // The backend already retires processes whose initialization failed.
      if (!String(error).includes('Engine not found:')) throw error;
    }
  },
};

const REUSE_KEY = 'shogi-reuse-analysis-engine';
export function useAnalysisSession(engines: EngineConfig[]) {
  const [state, setState] = useState<AnalysisState>(() => ({ status: 'idle', reuseEnabled: localStorage.getItem(REUSE_KEY) === 'true' }));
  const latest = useRef(state);
  const session = useRef<ReusableAnalysisSession | null>(null);
  useEffect(() => {
    const current = new ReusableAnalysisSession(analysisTransport, value => {
      latest.current = value;
      if (value.search) thinkingHistoryStore.record(value.search, value.engineName ?? 'Analysis engine', 'analysis', thinkingStatus(value.status, value.search));
      setState(value);
    }, latest.current.reuseEnabled);
    session.current = current;
    return () => {
      session.current = null;
      const value = latest.current;
      if (value.search && !value.search.complete) thinkingHistoryStore.record(value.search, value.engineName ?? 'Analysis engine', 'analysis', 'stopped');
      void current.dispose();
    };
  }, []);
  const onAction = useCallback((action: AnalysisAction) => {
    if (!action || !session.current) return;
    if (action.type === 'stop') void session.current.stop();
    else if (action.type === 'clear') void session.current.clear();
    else if (action.type === 'release') void session.current.releaseEngine();
    else if (action.type === 'reuse' && typeof action.enabled === 'boolean') {
      try { localStorage.setItem(REUSE_KEY, String(action.enabled)); } catch { /* Preference remains usable for this session. */ }
      void session.current.setReuse(action.enabled);
    }
    else if (action.type === 'start') {
      const engine = engines.find(item => item.id === action.engineId && item.enabled);
      if (engine) void session.current.start({ engine, rootSfen: action.rootSfen, candidates: action.candidates, seconds: action.seconds });
    }
  }, [engines]);
  return { state, onAction };
}
