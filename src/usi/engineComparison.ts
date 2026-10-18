import { Position } from 'tsshogi';
import { validSearchBudget, type SearchBudget } from './searchBudget';
import type { EngineConfig } from '../types/engine';
import { AnalysisSession, analysisOptions, maxCandidates, type AnalysisState, type AnalysisTransport } from './analysisSession';

export interface ComparisonState {
  version: 1;
  busy: boolean;
  rootSfen?: string;
  seconds?: number;
  budget?: SearchBudget;
  restored?: boolean;
  candidates?: number;
  engines?: Array<{ id: string; name: string }>;
  options?: Array<Record<string, string> | null>;
  sides: [AnalysisState, AnalysisState];
  error?: string;
}
export type ComparisonAction = { type: 'comparison-start'; engineIds: [string, string]; seconds: number; candidates: number; budget?: SearchBudget } | { type: 'comparison-stop' };
export const emptyComparison = (): ComparisonState => ({ version: 1, busy: false, sides: [{ status: 'idle' }, { status: 'idle' }] });
const active = (state: AnalysisState) => ['starting', 'running', 'stopping'].includes(state.status);
interface Run { cancelled: boolean; sessions: AnalysisSession[]; setup: Promise<void> }

/** The playing engines are never reused; both sides get the exact captured root and budget. */
export class EngineComparisonSession {
  private state = emptyComparison();
  private run?: Run;
  private disposed = false;
  constructor(private transport: AnalysisTransport, private publish: (state: ComparisonState) => void, initialState = emptyComparison()) { this.state = initialState; }
  private update(next: ComparisonState) { this.state = next; if (!this.disposed) this.publish(next); }
  async start(engines: [EngineConfig, EngineConfig], rootSfen: string, seconds: number, candidates: number, budget: SearchBudget = { kind: 'time', value: seconds }) {
    if (this.disposed || this.state.busy) return;
    if (engines[0].id === engines[1].id || engines.some(engine => !engine.enabled) || !Position.newBySFEN(rootSfen) || !Number.isFinite(seconds) || seconds < 1 || seconds > 60 || !validSearchBudget(budget) || !Number.isInteger(candidates) || candidates < 1 || engines.some(engine => candidates > maxCandidates(engine))) {
      this.update({ ...this.state, error: 'Choose two different enabled engines, a valid position, a supported candidate count and a valid time, depth or node budget.' });
      return;
    }
    const frozenBudget = { ...budget };
    const snapshots: [EngineConfig, EngineConfig] = JSON.parse(JSON.stringify(engines));
    const run: Run = { cancelled: false, sessions: [], setup: Promise.resolve() };
    this.run = run;
    this.update({ version: 1, busy: true, rootSfen, seconds, budget: frozenBudget, candidates, engines: snapshots.map(engine => ({ id: engine.id, name: engine.display_name || engine.name })), sides: [{ status: 'starting' }, { status: 'starting' }] });
    run.setup = (async () => {
      const options = await Promise.allSettled(snapshots.map(async engine => ({ ...await this.transport.options(engine.id) })));
      if (run.cancelled || this.run !== run) return;
      this.update({ ...this.state, options: options.map((result, index) => result.status === 'fulfilled' ? analysisOptions(snapshots[index], result.value, candidates) : null) });
      await Promise.all(snapshots.map(async (engine, index) => {
        const result = options[index];
        const change = (side: AnalysisState) => {
          if (this.run !== run || this.disposed) return;
          const sides: [AnalysisState, AnalysisState] = [...this.state.sides];
          sides[index] = side;
          this.update({ ...this.state, sides, busy: sides.some(active) });
        };
        if (result.status === 'rejected') { change({ status: 'error', engineName: engine.display_name || engine.name, error: String(result.reason) }); return; }
        const session = new AnalysisSession({ ...this.transport, options: async () => ({ ...result.value }) }, change);
        run.sessions.push(session);
        await session.start({ engine, rootSfen, seconds, candidates, budget: frozenBudget });
      }));
    })();
    await run.setup;
  }
  async stop() {
    const run = this.run;
    if (!run || !this.state.busy) return;
    run.cancelled = true;
    this.update({ ...this.state, sides: this.state.sides.map(side => active(side) ? { ...side, status: 'stopping' } : side) as [AnalysisState, AnalysisState] });
    await Promise.all(run.sessions.map(session => session.stop()));
    await run.setup;
    if (this.run === run) this.update({ ...this.state, busy: false, sides: this.state.sides.map(side => active(side) ? { ...side, status: 'stopped' } : side) as [AnalysisState, AnalysisState] });
  }
  async dispose() { this.disposed = true; await this.stop(); await Promise.all(this.run?.sessions.map(session => session.dispose()) ?? []); }
}
