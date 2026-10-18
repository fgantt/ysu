import { Position } from 'tsshogi';
import { searchBudgetCommand, validSearchBudget, type SearchBudget } from './searchBudget';
import type { EngineConfig } from '../types/engine';
import { updateCandidateSearch, type CandidateSearch } from '../utils/candidateAnalysis';

export type AnalysisStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'complete' | 'stopped' | 'error';
export interface AnalysisState { status: AnalysisStatus; reuseEnabled?: boolean; engineReady?: boolean; engineRetained?: boolean; reused?: boolean; search?: CandidateSearch; engineName?: string; error?: string; diagnostic?: string }
export interface AnalysisRequest { engine: EngineConfig; rootSfen: string; candidates: number; seconds: number; budget?: SearchBudget; searchMoves?: string[] }
export type AnalysisAction = { type: 'start'; engineId: string; rootSfen: string; candidates: number; seconds: number } | { type: 'stop' } | { type: 'clear' } | { type: 'reuse'; enabled: boolean } | { type: 'release' };
export interface AnalysisTransport {
  listen: (id: string, onMessage: (message: string) => void, onError: (error: string) => void) => Promise<() => void>;
  options: (engineId: string) => Promise<Record<string, string>>;
  spawn: (id: string, engine: EngineConfig, options: Record<string, string>) => Promise<void>;
  send: (id: string, command: string) => Promise<void>;
  terminate: (id: string) => Promise<void>;
}

export function multiPvOption(engine: EngineConfig) {
  return engine.metadata?.options.find(option => /^(USI_)?MultiPV$/i.test(option.name) && option.option_type === 'spin');
}
export function maxCandidates(engine: EngineConfig): number {
  const option = multiPvOption(engine);
  if (!option) return 1;
  const max = Number(option.max);
  return Number.isFinite(max) && max >= 1 ? Math.min(5, Math.floor(max)) : 1;
}

export function analysisOptions(engine: EngineConfig, saved: Record<string, string>, candidates: number): Record<string, string> {
  const options = { ...saved };
  const multipv = multiPvOption(engine);
  if (multipv) options[multipv.name] = String(candidates);
  // Conservative temporary limits keep this extra engine practical alongside a game.
  for (const option of engine.metadata?.options ?? []) {
    if (option.option_type === 'check' && /^(USI_)?OwnBook$/i.test(option.name)) options[option.name] = 'false';
    if (option.option_type === 'check' && /^USI_AnalyseMode$/i.test(option.name)) options[option.name] = 'true';
    if (option.option_type !== 'spin') continue;
    const target = /^(USI_)?Threads$/i.test(option.name) ? 2 : /^USI_Hash$/i.test(option.name) ? 128 : undefined;
    if (target === undefined) continue;
    const min = Number(option.min ?? 1);
    const max = Number(option.max ?? target);
    if (Number.isFinite(min) && Number.isFinite(max)) options[option.name] = String(Math.max(min, Math.min(max, target)));
  }
  return options;
}

interface Runtime {
  id: string;
  cancelled: boolean;
  searching: boolean;
  spawned: boolean;
  setup: Promise<void>;
  release?: Promise<void>;
  unlisten?: () => void;
  watchdog?: ReturnType<typeof setTimeout>;
}

/** Owns a separate, short-lived engine instance for every analysis request. */
export class AnalysisSession {
  private runtime?: Runtime;
  private disposed = false;
  private state: AnalysisState = { status: 'idle' };
  constructor(private transport: AnalysisTransport, private publish: (state: AnalysisState) => void) {}

  private update(next: AnalysisState) {
    this.state = next;
    if (!this.disposed) this.publish(next);
  }

  private release(runtime: Runtime): Promise<void> {
    if (!runtime.release) runtime.release = (async () => {
      await runtime.setup.catch(() => {});
      clearTimeout(runtime.watchdog);
      runtime.unlisten?.();
      if (runtime.spawned) await this.transport.terminate(runtime.id);
      if (this.runtime === runtime) this.runtime = undefined;
    })();
    return runtime.release;
  }

  private async finish(runtime: Runtime, status: AnalysisStatus, error?: string) {
    if (runtime.cancelled) return;
    runtime.cancelled = true;
    this.update({ ...this.state, status: 'stopping' });
    try {
      await this.release(runtime);
      this.update({ ...this.state, status, error, search: this.state.search ? { ...this.state.search, complete: true } : undefined });
    } catch (cause) {
      this.update({ ...this.state, status: 'error', error: `Could not close the analysis engine: ${String(cause)}` });
    }
  }

  async start(request: AnalysisRequest) {
    if (this.disposed || this.runtime) return;
    const { engine, rootSfen, candidates, seconds } = request;
    const budget = { ...(request.budget ?? { kind: 'time' as const, value: seconds }) };
    if (!engine.enabled || !Position.newBySFEN(rootSfen) || !Number.isInteger(candidates) || candidates < 1 || candidates > maxCandidates(engine) || !Number.isFinite(seconds) || seconds < 1 || seconds > 60 || !validSearchBudget(budget)) {
      this.update({ status: 'error', error: 'Choose an enabled engine, a valid position, a valid search budget, and a supported candidate count.' });
      return;
    }
    const searchMoves = request.searchMoves ? [...request.searchMoves] : undefined;
    const root = Position.newBySFEN(rootSfen)!;
    if (searchMoves && (!searchMoves.length || searchMoves.some(usi => { const move = root.createMoveByUSI(usi); return !move || move.usi !== usi || !root.isValidMove(move); }))) {
      this.update({ status: 'error', error: 'Restricted search requires legal root moves.' }); return;
    }
    const runtime: Runtime = { id: `analysis-${crypto.randomUUID()}`, cancelled: false, searching: false, spawned: false, setup: Promise.resolve() };
    this.runtime = runtime;
    this.update({ status: 'starting', engineName: engine.display_name || engine.name, search: { engineId: runtime.id, rootSfen, complete: false, lines: [] } });
    runtime.setup = (async () => {
      runtime.unlisten = await this.transport.listen(runtime.id, message => {
        if (runtime.cancelled || !runtime.searching || this.runtime !== runtime || !this.state.search) return;
        const search = updateCandidateSearch(this.state.search, message);
        if (search !== this.state.search) this.update({ ...this.state, search });
        if (message.startsWith('bestmove ')) {
          const best = message.split(/\s+/)[1];
          if (searchMoves && !searchMoves.includes(best)) void this.finish(runtime, 'error', 'The engine did not honor the restricted move search.');
          else void this.finish(runtime, 'complete');
        }
      }, error => {
        if (runtime.cancelled || this.runtime !== runtime) return;
        if (error === 'Engine process died') void this.finish(runtime, 'error', error);
        else this.update({ ...this.state, diagnostic: error });
      });
      if (runtime.cancelled) return;
      const saved = await this.transport.options(engine.id);
      const options = analysisOptions(engine, saved, candidates);
      if (runtime.cancelled) return;
      // Mark ownership before spawn, so partial initialization failures are also cleaned up.
      runtime.spawned = true;
      await this.transport.spawn(runtime.id, engine, options);
      if (runtime.cancelled) return;
      await this.transport.send(runtime.id, 'usinewgame');
      if (runtime.cancelled) return;
      await this.transport.send(runtime.id, `position sfen ${rootSfen}`);
      if (runtime.cancelled) return;
      runtime.searching = true;
      this.update({ ...this.state, status: 'running' });
      runtime.watchdog = setTimeout(() => { void this.finish(runtime, 'error', budget.kind === 'time' ? 'The analysis engine did not finish within its time limit. Try a shorter search or another engine.' : 'The engine did not finish its depth/node search within the 60-second safety limit. Results are partial; try a smaller budget or another engine.'); }, budget.kind === 'time' ? budget.value * 1000 + 5000 : 60_000);
      await this.transport.send(runtime.id, `${searchBudgetCommand(budget)}${searchMoves ? ` searchmoves ${searchMoves.join(' ')}` : ''}`);
    })();
    try { await runtime.setup; }
    catch (error) { await this.finish(runtime, 'error', String(error)); }
  }

  async stop() {
    const runtime = this.runtime;
    if (!runtime || runtime.cancelled) return;
    runtime.cancelled = true;
    this.update({ ...this.state, status: 'stopping' });
    try {
      await runtime.setup.catch(() => {});
      if (runtime.searching) await this.transport.send(runtime.id, 'stop').catch(() => {});
      await this.release(runtime);
      this.update({ ...this.state, status: 'stopped', search: this.state.search ? { ...this.state.search, complete: true } : undefined });
    } catch (error) { this.update({ ...this.state, status: 'error', error: String(error) }); }
  }

  clear() { if (!this.runtime) this.update({ status: 'idle' }); }
  async dispose() { this.disposed = true; await this.stop(); }
}
