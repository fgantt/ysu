import { describe, expect, it, vi } from 'vitest';
import { ThinkingHistoryStore } from './thinkingHistory';
import type { CandidateSearch } from './candidateAnalysis';
const search = (id: string, complete = false): CandidateSearch => ({ engineId: 'engine', searchId: id, rootSfen: 'root', complete, lines: [], metrics: { depth: 4, nodes: 100 } });
describe('thinking history', () => {
  it('updates one record per search and preserves distinct searches at the same position', () => {
    const store = new ThinkingHistoryStore(100, () => 1000);
    store.record(search('one'), 'A', 'game');
    store.record({ ...search('one', true), metrics: { depth: 8, nodes: 1000 } }, 'A', 'game');
    store.record(search('two'), 'A', 'game');
    expect(store.getSnapshot()).toHaveLength(2);
    expect(store.getSnapshot()[1].status).toBe('complete');
    expect(store.getSnapshot()[1].search.metrics?.nodes).toBe(1000);
    expect(store.getSnapshot()[0].status).toBe('searching');
  });
  it('captures final snapshots before rapid review transitions and keeps independent sources', () => {
    const store = new ThinkingHistoryStore();
    store.record(search('one'), 'A', 'review');
    store.record(search('one', true), 'A', 'review');
    store.record({ ...search('two'), engineId: 'other' }, 'B', 'comparison');
    expect(store.getSnapshot()[1].status).toBe('complete');
    expect(store.getSnapshot().map(entry => entry.source)).toEqual(['comparison', 'review']);
  });
  it('copies candidate lines and metrics so later mutations cannot change saved history', () => {
    const store = new ThinkingHistoryStore();
    const value = { ...search('one', true), lines: [{ rank: 1, moves: ['7g7f'], score: 12 }] };
    store.record(value, 'A', 'analysis');
    value.lines[0].moves.push('3c3d');
    value.metrics!.nodes = 200;
    expect(store.getSnapshot()[0].search.lines[0].moves).toEqual(['7g7f']);
    expect(store.getSnapshot()[0].search.metrics?.nodes).toBe(100);
  });
  it('marks a replaced playing search as interrupted rather than complete', () => {
    const store = new ThinkingHistoryStore();
    store.record(search('one'), 'A', 'game');
    store.record(search('two'), 'A', 'game');
    expect(store.getSnapshot()[1].status).toBe('interrupted');
  });
  it('bounds finished records while protecting active searches and does not resurrect evicted results', () => {
    const store = new ThinkingHistoryStore(2);
    store.record({ ...search('active'), engineId: 'active' }, 'Active', 'comparison');
    const old = search('one', true);
    store.record(old, 'A', 'game');
    store.record(search('two', true), 'A', 'game');
    store.record(search('three', true), 'A', 'game');
    store.record(old, 'A', 'game');
    expect(store.getSnapshot().map(entry => entry.search.searchId)).toEqual(['three', 'two', 'active']);
  });
  it('clears finished entries without clearing active searches or readding cleared snapshots', () => {
    const store = new ThinkingHistoryStore();
    const done = search('done', true);
    store.record(done, 'A', 'game');
    store.record(search('active'), 'A', 'game');
    store.clearFinished();
    store.record(done, 'A', 'game');
    expect(store.getSnapshot()).toHaveLength(1);
    store.record(search('active', true), 'A', 'game');
    expect(store.getSnapshot()[0].status).toBe('complete');
  });
  it('publishes only changed snapshots and supports unsubscribing', () => {
    const store = new ThinkingHistoryStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    const value = search('one');
    store.record(value, 'A', 'game');
    store.record(value, 'A', 'game');
    expect(listener).toHaveBeenCalledOnce();
    stop();
    store.record(search('two'), 'A', 'game');
    expect(listener).toHaveBeenCalledOnce();
  });
});
