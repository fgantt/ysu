import { AnalysisSession, type AnalysisRequest, type AnalysisState, type AnalysisTransport } from './analysisSession';

interface EngineProcess { id: string; key: string; spawned: boolean; unlisten?: () => void; tainted?: boolean }
interface Run {
  session?: AnalysisSession;
  process?: EngineProcess;
  onMessage?: (message: string) => void;
  onError?: (error: string) => void;
  ready?: { resolve: () => void; reject: (error: Error) => void };
  accepting: boolean;
  successful: boolean;
  cancelled: boolean;
  reused: boolean;
  saved: Record<string, string>;
  done: Promise<void>;
  resolveDone: () => void;
}
const busy = (state: AnalysisState) => ['starting', 'running', 'stopping'].includes(state.status);
const optionKey = (options: Record<string, string>) => Object.entries(options).sort(([a], [b]) => a.localeCompare(b));

/** Optional warm process for dedicated analysis only. Review/comparison retain fresh-process isolation. */
export class ReusableAnalysisSession {
  private current?: Run;
  private cached?: EngineProcess;
  private closing?: Promise<void>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private state: AnalysisState = { status: 'idle' };
  private reuse: boolean;
  constructor(private transport: AnalysisTransport, private publish: (state: AnalysisState) => void, reuse = false, private idleMs = 120_000) {
    this.reuse = reuse;
  }
  private update(next: AnalysisState) {
    this.state = { ...next, reuseEnabled: this.reuse, engineReady: !!this.cached && !this.cached.tainted, engineRetained: !!this.cached, reused: next.search ? this.current?.reused ?? false : false };
    if (!this.disposed) this.publish(this.state);
  }
  async setReuse(enabled: boolean) {
    this.reuse = enabled;
    this.update(this.state);
    if (!enabled && !busy(this.state)) await this.releaseEngine();
  }
  private async closeProcess(process: EngineProcess) {
    process.unlisten?.();
    process.unlisten = undefined;
    if (process.spawned) { await this.transport.terminate(process.id); process.spawned = false; }
  }
  async releaseEngine() {
    if (this.closing) return this.closing;
    if (busy(this.state) || !this.cached) return;
    clearTimeout(this.idleTimer);
    const process = this.cached;
    this.cached = undefined;
    const previous = this.state;
    this.update({ ...previous, status: 'stopping' });
    this.closing = (async () => {
      try { await this.closeProcess(process); this.update(previous); }
      catch (error) { process.tainted = true; this.cached = process; this.update({ ...previous, status: 'error', error: `Could not close the retained analysis engine: ${String(error)}` }); }
      finally { this.closing = undefined; }
    })();
    await this.closing;
  }
  async start(request: AnalysisRequest) {
    if (this.disposed || busy(this.state) || this.closing) return;
    void this.current?.session?.dispose();
    const snapshot: AnalysisRequest = { ...request, engine: JSON.parse(JSON.stringify(request.engine)), searchMoves: request.searchMoves ? [...request.searchMoves] : undefined, budget: request.budget ? { ...request.budget } : undefined };
    let resolveDone!: () => void;
    const done = new Promise<void>(resolve => { resolveDone = resolve; });
    const run: Run = { accepting: false, successful: false, cancelled: false, reused: false, saved: {}, done, resolveDone };
    const wrapped: AnalysisTransport = {
      options: async id => { run.saved = { ...await this.transport.options(id) }; return { ...run.saved }; },
      listen: async (_id, onMessage, onError) => {
        run.onMessage = onMessage;
        run.onError = onError;
        return () => { run.accepting = false; run.process?.unlisten?.(); if (run.process) run.process.unlisten = undefined; };
      },
      spawn: async (id, engine, options) => {
        const key = JSON.stringify([engine.id, engine.name, engine.path, engine.metadata, optionKey(run.saved), optionKey(options)]);
        clearTimeout(this.idleTimer);
        if (this.cached && (!this.reuse || this.cached.key !== key || this.cached.tainted)) {
          const old = this.cached;
          old.tainted = true;
          await this.closeProcess(old);
          this.cached = undefined;
        }
        if (run.cancelled || this.disposed) return;
        const process = this.cached ?? { id, key, spawned: false };
        run.reused = !!this.cached;
        this.cached = undefined;
        process.unlisten?.();
        process.unlisten = undefined;
        run.process = process;
        process.unlisten = await this.transport.listen(process.id, message => {
          if (message.trim() === 'readyok') run.ready?.resolve();
          if (!run.accepting || run.cancelled || this.current !== run) return;
          if (message.startsWith('bestmove ')) {
            const best = message.split(/\s+/)[1];
            run.successful = !snapshot.searchMoves || snapshot.searchMoves.includes(best);
          }
          run.onMessage?.(message);
        }, error => {
          if (error === 'Engine process died') { process.tainted = true; run.ready?.reject(new Error(error)); }
          run.onError?.(error);
        });
        if (run.cancelled || this.disposed) return;
        if (process.tainted) throw new Error('Engine process died');
        if (!run.reused) {
          process.spawned = true; // Own partial initialization failures too.
          await this.transport.spawn(process.id, engine, options);
        }
      },
      send: async (_id, command) => {
        const process = run.process;
        if (!process) throw new Error('Analysis engine is unavailable.');
        if (command === 'usinewgame') {
          await this.transport.send(process.id, command);
          if (run.cancelled || this.disposed) return;
          if (run.reused) {
            const clearHash = snapshot.engine.metadata?.options.find(option => option.option_type === 'button' && /^(USI_)?Clear[ _]?Hash$/i.test(option.name));
            if (clearHash) await this.transport.send(process.id, `setoption name ${clearHash.name}`);
          }
          if (run.cancelled || this.disposed) return;
          if (this.reuse || run.reused) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await new Promise<void>((resolve, reject) => {
                run.ready = { resolve, reject };
                timer = setTimeout(() => reject(new Error('Analysis engine readiness timed out; the process was retired.')), 5000);
                void this.transport.send(process.id, 'isready').catch(reject);
              });
            } finally { clearTimeout(timer); run.ready = undefined; }
          }
        } else {
          if (command.startsWith('go ')) run.accepting = true;
          await this.transport.send(process.id, command);
        }
      },
      terminate: async () => {
        try {
          const process = run.process;
          if (!process) return;
          if (this.reuse && run.successful && !run.cancelled && !process.tainted && !this.disposed) {
            this.cached = process;
            try { process.unlisten = await this.transport.listen(process.id, () => {}, error => {
              if (error === 'Engine process died' && this.cached === process) {
                process.tainted = true;
                void this.releaseEngine();
              }
            }); } catch (error) { this.cached = undefined; await this.closeProcess(process); throw error; }
            if (!this.reuse || run.cancelled || this.disposed || process.tainted) {
              this.cached = undefined;
              await this.closeProcess(process);
            } else this.idleTimer = setTimeout(() => { void this.releaseEngine(); }, this.idleMs);
          } else await this.closeProcess(process);
        } catch (error) {
          if (run.process?.spawned) { run.process.tainted = true; this.cached = run.process; }
          throw error;
        } finally { run.resolveDone(); }
      },
    };
    run.session = new AnalysisSession(wrapped, value => {
      if (this.current !== run) return;
      if (['error', 'stopped', 'complete'].includes(value.status) && !run.process) run.resolveDone();
      this.update(value);
      if (value.status === 'error' && this.cached) void this.releaseEngine();
    });
    this.current = run;
    await run.session.start(snapshot);
  }
  async stop() {
    const run = this.current;
    if (run && busy(this.state)) {
      run.cancelled = true;
      run.ready?.reject(new Error('Analysis startup cancelled.'));
      await run.session?.stop();
      if (run.process) await run.done;
      await this.releaseEngine();
    } else await this.releaseEngine();
  }
  async clear() {
    if (busy(this.state)) return;
    await this.releaseEngine();
    if (!this.cached) this.update({ status: 'idle' });
  }
  async dispose() {
    this.disposed = true;
    clearTimeout(this.idleTimer);
    const run = this.current;
    if (run) {
      run.cancelled = true;
      run.ready?.reject(new Error('Analysis session closed.'));
      await run.session?.dispose();
      if (run.process) await run.done;
    }
    // dispose suppresses publication; allow idle cleanup even if the last status was stopping.
    this.state = { ...this.state, status: 'idle' };
    await this.releaseEngine();
    await this.closing;
  }
}
