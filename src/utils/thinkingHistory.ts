import type { CandidateSearch } from './candidateAnalysis';

export type ThinkingSource = 'game' | 'analysis' | 'review' | 'comparison';
export type ThinkingStatus = 'searching' | 'complete' | 'stopped' | 'error' | 'interrupted';
export interface ThinkingHistoryEntry {
  id: string;
  source: ThinkingSource;
  engineName: string;
  startedAt: number;
  finishedAt?: number;
  status: ThinkingStatus;
  search: CandidateSearch;
}
export type ThinkingAction = { type: 'thinking-clear' } | { type: 'thinking-preview'; id: string; rank: number };
export const thinkingSourceName: Record<ThinkingSource, string> = { game: 'Game', analysis: 'Dedicated Analysis', review: 'Game Review', comparison: 'Engine Comparison' };
export const THINKING_HISTORY_LIMIT = 100;

/** Main-window session memory; records are captured before React can batch search transitions. */
export class ThinkingHistoryStore {
  private entries: ThinkingHistoryEntry[] = [];
  private inputs = new Map<string, CandidateSearch>();
  private listeners = new Set<() => void>();
  private ignored = new Set<string>();
  constructor(private limit = THINKING_HISTORY_LIMIT, private now = Date.now) {}
  getSnapshot = () => this.entries;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { for (const listener of this.listeners) listener(); }
  record(search: CandidateSearch | undefined, engineName: string, source: ThinkingSource, status?: ThinkingStatus) {
    if (!search) return;
    const id = `${source}:${search.searchId ?? search.engineId}`;
    if (this.ignored.has(id)) return;
    const nextStatus = status ?? (search.complete ? 'complete' : 'searching');
    const previous = this.entries.find(entry => entry.id === id);
    if (previous?.status === 'error' && nextStatus === 'stopped') return;
    if (previous && this.inputs.get(id) === search && previous.engineName === engineName && previous.status === nextStatus) return;
    this.inputs.set(id, search);
    const snapshot: CandidateSearch = { ...search, metrics: search.metrics ? { ...search.metrics } : undefined,
      lines: search.lines.slice(0, 5).map(line => ({ ...line, moves: line.moves.slice(0, 256) })) };
    const time = this.now();
    const entry: ThinkingHistoryEntry = { id, source, engineName, startedAt: previous?.startedAt ?? time,
      finishedAt: nextStatus === 'searching' ? undefined : previous?.finishedAt ?? time, status: nextStatus, search: snapshot };
    // A reused playing process may start another search without reporting bestmove for the old one.
    const entries = this.entries.map(item => item.id !== id && item.source === source && item.search.engineId === search.engineId && item.status === 'searching'
      ? { ...item, status: 'interrupted' as const, finishedAt: time } : item);
    this.entries = previous ? entries.map(item => item.id === id ? entry : item) : [entry, ...entries];
    const finished = this.entries.filter(item => item.status !== 'searching');
    const expired = new Set(finished.slice(this.limit).map(item => item.id));
    for (const key of expired) { this.inputs.delete(key); this.ignored.add(key); }
    this.entries = this.entries.filter(item => !expired.has(item.id));
    // Keep the suppression cache bounded, while retaining recently cleared/evicted run IDs.
    if (this.ignored.size > 1000) this.ignored = new Set([...this.ignored].slice(-1000));
    this.publish();
  }
  clearFinished = () => {
    for (const entry of this.entries) if (entry.status !== 'searching') { this.ignored.add(entry.id); this.inputs.delete(entry.id); }
    this.entries = this.entries.filter(entry => entry.status === 'searching');
    this.publish();
  };
}
export const thinkingHistoryStore = new ThinkingHistoryStore();
export function thinkingStatus(status: string, search: CandidateSearch): ThinkingStatus {
  if (status === 'error') return 'error';
  if (status === 'stopped') return 'stopped';
  return search.complete ? 'complete' : 'searching';
}
