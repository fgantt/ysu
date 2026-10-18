import { Position } from 'tsshogi';
import type { EngineConfig } from '../types/engine';
import type { CandidateSearch } from '../utils/candidateAnalysis';
import { AnalysisSession, type AnalysisStatus, type AnalysisTransport } from './analysisSession';

export type ReviewMethod = 'adjacent' | 'forced';
export interface ReviewRecord { initialSfen: string; moves: string[] }
export interface ReviewRow {
  ply: number; move: string; side: 'Sente' | 'Gote'; rootSfen: string; afterSfen: string;
  before?: number; after?: number; loss?: number; bestLine: string[]; playedLine?: string[];
}
export interface ReviewState {
  version: 1; status: 'idle' | 'running' | 'stopping' | 'complete' | 'stopped' | 'error';
  method?: ReviewMethod;
  record?: ReviewRecord; engineId?: string; engineName?: string; seconds?: number; settingsKey?: string;
  searchStatus?: AnalysisStatus;
  search?: CandidateSearch; completed: number; total: number; rows: ReviewRow[]; error?: string;
}
export const emptyReview: ReviewState = { version: 1, status: 'idle', completed: 0, total: 0, rows: [] };
export function reviewSnapshotKey(state: ReviewState): string {
  return JSON.stringify([state.record ? recordKey(state.record) : null, state.engineId, state.settingsKey, state.seconds, state.method]);
}
export function recordKey(record: ReviewRecord): string { return JSON.stringify([record.initialSfen, record.moves]); }
export function reviewPositions(record: ReviewRecord): string[] {
  const position = Position.newBySFEN(record.initialSfen);
  if (!position) throw new Error('The game has an invalid starting position.');
  const positions = [position.sfen];
  for (const [index, usi] of record.moves.entries()) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`Move ${index + 1} cannot be replayed: ${usi}`);
    positions.push(position.sfen);
  }
  return positions;
}
export function senteScore(search: CandidateSearch): number | undefined {
  const line = search.lines.find(item => item.rank === 1);
  if (!line || line.bound || line.score === undefined || !Number.isFinite(line.score) || line.mate !== undefined) return undefined;
  return line.score * (search.rootSfen.split(' ')[1] === 'w' ? -1 : 1);
}
export function reviewRows(record: ReviewRecord, searches: CandidateSearch[]): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (let index = 0; index < Math.min(record.moves.length, searches.length - 1); index++) {
    const beforeSearch = searches[index];
    const afterSearch = searches[index + 1];
    const before = senteScore(beforeSearch);
    const after = senteScore(afterSearch);
    const side = beforeSearch.rootSfen.split(' ')[1] === 'w' ? 'Gote' : 'Sente';
    const line = beforeSearch.lines.find(item => item.rank === 1)?.moves ?? [];
    rows.push({ ply: index + 1, move: record.moves[index], side, rootSfen: beforeSearch.rootSfen, afterSfen: afterSearch.rootSfen,
      before, after, loss: before !== undefined && after !== undefined ? Math.max(0, (before - after) * (side === 'Sente' ? 1 : -1)) : undefined, bestLine: [...line] });
  }
  return rows;
}


export function forcedReviewRows(record: ReviewRecord, searches: CandidateSearch[], positions = reviewPositions(record)): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (let index = 0; index < Math.min(record.moves.length, Math.floor(searches.length / 2)); index++) {
    const best = searches[index * 2], played = searches[index * 2 + 1];
    if (best.rootSfen !== positions[index] || played.rootSfen !== positions[index]) throw new Error('Review search position mismatch.');
    const playedLine = played.lines.find(line => line.rank === 1)?.moves ?? [];
    if (playedLine.length && playedLine[0] !== record.moves[index]) throw new Error('The engine returned a continuation for a different restricted move.');
    const before = senteScore(best), after = playedLine[0] === record.moves[index] ? senteScore(played) : undefined;
    const side = positions[index].split(' ')[1] === 'w' ? 'Gote' : 'Sente';
    rows.push({ ply: index + 1, move: record.moves[index], side, rootSfen: positions[index], afterSfen: positions[index + 1], before, after,
      loss: before !== undefined && after !== undefined ? Math.max(0, (before - after) * (side === 'Sente' ? 1 : -1)) : undefined,
      bestLine: [...(best.lines.find(line => line.rank === 1)?.moves ?? [])], playedLine: [...playedLine] });
  }
  return rows;
}

interface Run { cancelled: boolean; session?: AnalysisSession; task: Promise<void> }
export class GameReviewRunner {
  private run?: Run;
  private disposed = false;
  private state: ReviewState = emptyReview;
  constructor(private transport: AnalysisTransport, private publish: (state: ReviewState) => void) {}
  private update(value: ReviewState) { this.state = value; if (!this.disposed) this.publish(value); }
  restore(value: ReviewState) { if (!this.run) this.update(value); }
  async start(record: ReviewRecord, engine: EngineConfig, seconds: number, method: ReviewMethod = 'adjacent') {
    if (this.run || this.disposed) return;
    const snapshot = { initialSfen: record.initialSfen, moves: [...record.moves] };
    let positions: string[];
    try {
      if (!snapshot.moves.length || !engine.enabled || !Number.isFinite(seconds) || seconds < 1 || seconds > 60) throw new Error('Choose an enabled engine and a game with moves to review.');
      positions = reviewPositions(snapshot);
    } catch (error) { this.update({ ...emptyReview, status: 'error', error: String(error) }); return; }
    const run: Run = { cancelled: false, task: Promise.resolve() };
    this.run = run;
    this.update({ ...emptyReview, status: 'running', record: snapshot, engineId: engine.id, engineName: engine.display_name || engine.name, seconds, method, total: method === 'forced' ? snapshot.moves.length * 2 : positions.length });
    run.task = (async () => {
      const saved = { ...await this.transport.options(engine.id) };
      if (run.cancelled) return;
      // Freeze settings across all positions; UI changes to saved settings cannot affect a running review.
      const transport = { ...this.transport, options: async () => ({ ...saved }) };
      this.update({ ...this.state, settingsKey: JSON.stringify([engine.id, engine.path, engine.metadata, seconds, method, Object.entries(saved).sort()]) });
      const searches: CandidateSearch[] = [];
      const jobs = method === 'forced' ? snapshot.moves.flatMap((move, index) => [{ rootSfen: positions[index], searchMoves: undefined }, { rootSfen: positions[index], searchMoves: [move] }]) : positions.map(rootSfen => ({ rootSfen, searchMoves: undefined }));
      for (const { rootSfen, searchMoves } of jobs) {
        if (run.cancelled) break;
        const result = await new Promise<CandidateSearch | undefined>((resolve, reject) => {
          const session = new AnalysisSession(transport, state => {
            if (state.search && !run.cancelled) this.update({ ...this.state, search: state.search, searchStatus: state.status });
            if (state.status === 'complete') resolve(state.search);
            else if (state.status === 'stopped') resolve(undefined);
            else if (state.status === 'error') reject(new Error(state.error ?? 'Position analysis failed.'));
          });
          run.session = session;
          void session.start({ engine, rootSfen, candidates: 1, seconds, searchMoves });
        });
        await run.session?.dispose();
        run.session = undefined;
        if (!result || run.cancelled) break;
        searches.push(result);
        this.update({ ...this.state, completed: searches.length, rows: method === 'forced' ? forcedReviewRows(snapshot, searches, positions) : reviewRows(snapshot, searches) });
      }
    })();
    try { await run.task; this.update({ ...this.state, status: run.cancelled ? 'stopped' : 'complete' }); }
    catch (error) { this.update({ ...this.state, status: run.cancelled ? 'stopped' : 'error', error: run.cancelled ? undefined : String(error) }); }
    finally { await run.session?.dispose(); if (this.run === run) this.run = undefined; }
  }
  async stop() {
    const run = this.run;
    if (!run || run.cancelled) return;
    run.cancelled = true;
    this.update({ ...this.state, status: 'stopping' });
    await run.session?.stop();
    await run.task.catch(() => {});
  }
  async dispose() { this.disposed = true; await this.stop(); }
}
