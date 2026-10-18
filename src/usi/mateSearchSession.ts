import { Position } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import { analysisOptions, type AnalysisTransport } from './analysisSession';
import { parseThinkingMetrics, type ThinkingMetrics } from '../utils/candidateAnalysis';
import { parseMateReply, validateMateLine } from './mateResult';

export type MateSearchStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'found' | 'nomate' | 'timeout' | 'unsupported' | 'error';
export type MateCapability = 'unverified' | 'responded' | 'unsupported';
export interface MateSearchState { status: MateSearchStatus; rootSfen?: string; seconds?: number; engineId?: string; engineName?: string; capability?: MateCapability; moves?: string[]; metrics?: ThinkingMetrics; response?: string; options?: Record<string, string>; error?: string; diagnostic?: string }
export interface MateSearchRequest { engine: EngineConfig; rootSfen: string; seconds: number }
export type MateSearchAction = { type: 'mate-start'; engineId: string; seconds: number; rootSfen?: string } | { type: 'mate-stop' };

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

/** Owns a separate, short-lived engine instance for every mate-search request. */
export class MateSearchSession {
  private runtime?: Runtime;
  private disposed = false;
  private state: MateSearchState = { status: 'idle' };
  constructor(private transport: AnalysisTransport, private publish: (state: MateSearchState) => void) {}

  private update(next: MateSearchState) {
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

  private async finish(runtime: Runtime, status: MateSearchStatus, error?: string) {
    if (runtime.cancelled) return;
    runtime.cancelled = true;
    this.update({ ...this.state, status: 'stopping' });
    try {
      await this.release(runtime);
      this.update({ ...this.state, status, error });
    } catch (cause) {
      this.update({ ...this.state, status: 'error', error: `Could not close the mate-search engine: ${String(cause)}` });
    }
  }

  async start(request: MateSearchRequest) {
    if (this.disposed || this.runtime) return;
    const { engine, rootSfen, seconds } = request;
    if (!engine.enabled || !Position.newBySFEN(rootSfen) || !Number.isFinite(seconds) || seconds < 1 || seconds > 60) {
      this.update({ status: 'error', error: 'Choose an enabled engine, a valid position and 1–60 seconds.' });
      return;
    }
    const runtime: Runtime = { id: `mate-${crypto.randomUUID()}`, cancelled: false, searching: false, spawned: false, setup: Promise.resolve() };
    this.runtime = runtime;
    this.update({ status: 'starting', rootSfen, seconds, engineId: engine.id, engineName: engine.display_name || engine.name, capability: 'unverified' });
    runtime.setup = (async () => {
      runtime.unlisten = await this.transport.listen(runtime.id, message => {
        if (runtime.cancelled || !runtime.searching || this.runtime !== runtime) return;
        const metrics = parseThinkingMetrics(message);
        if (metrics) this.update({ ...this.state, metrics: { ...this.state.metrics, ...metrics } });
        try {
          const reply = parseMateReply(message);
          if (reply) {
            this.update({ ...this.state, capability: reply.kind === 'unsupported' ? 'unsupported' : 'responded', response: message });
            if (reply.kind === 'found') {
              validateMateLine(rootSfen, reply.moves);
              this.update({ ...this.state, moves: reply.moves });
            }
            void this.finish(runtime, reply.kind);
          } else if (/^\s*bestmove(?:\s|$)/.test(message)) {
            this.update({ ...this.state, capability: 'unsupported', response: message });
            void this.finish(runtime, 'unsupported', 'The engine returned a normal-search result instead of a dedicated mate result.');
          }
        } catch (error) { void this.finish(runtime, 'error', String(error)); }
      }, error => {
        if (runtime.cancelled || this.runtime !== runtime) return;
        if (error === 'Engine process died') void this.finish(runtime, 'error', error);
        else this.update({ ...this.state, diagnostic: error });
      });
      if (runtime.cancelled) return;
      const saved = await this.transport.options(engine.id);
      const options = analysisOptions(engine, saved, 1);
      if (runtime.cancelled) return;
      this.update({ ...this.state, options });
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
      runtime.watchdog = setTimeout(() => { void this.finish(runtime, 'timeout', 'No checkmate reply arrived within the search budget plus five seconds; mate-search support remains unverified.'); }, seconds * 1000 + 5000);
      await this.transport.send(runtime.id, `go mate ${Math.round(seconds * 1000)}`);
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
      this.update({ ...this.state, status: 'stopped' });
    } catch (error) { this.update({ ...this.state, status: 'error', error: String(error) }); }
  }

  clear() { if (!this.runtime) this.update({ status: 'idle' }); }
  async dispose() { this.disposed = true; await this.stop(); }
}
