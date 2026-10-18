import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineThinking } from './EngineThinking';
afterEach(cleanup);
describe('Engine Thinking', () => {
  it('shows metric-only packets without requiring a candidate line', () => {
    const { getByText } = render(<EngineThinking payload={{ currentSfen: 'root', engineNames: { engine: 'Engine' }, searches: [{ engineId: 'engine', rootSfen: 'root', complete: false, lines: [], metrics: { depth: 12, seldepth: 20, nodes: 1234, nps: 5000, time: 2500, hashfull: 250, currentMove: '7g7f' } }] }} />);
    expect(getByText('1,234')).toBeTruthy();
    expect(getByText('2.50 s')).toBeTruthy();
    expect(getByText('25.0%')).toBeTruthy();
    expect(getByText('7g7f')).toBeTruthy();
  });
  it('reports unavailable fields and finished searches explicitly', () => {
    const { getByText, getAllByText } = render(<EngineThinking payload={{ currentSfen: 'new', engineNames: {}, searches: [{ engineId: 'engine', rootSfen: 'old', complete: true, lines: [] }] }} />);
    expect(getByText('Search finished · Earlier position')).toBeTruthy();
    expect(getAllByText('Unavailable')).toHaveLength(7);
  });
});


it('keeps a historical selection stable during live updates and previews the saved candidate', () => {
  const history = [{ id: 'one', source: 'game' as const, engineName: 'Saved engine', startedAt: 1000, finishedAt: 2000, status: 'complete' as const, search: { engineId: 'engine', rootSfen: 'old', complete: true, lines: [{ rank: 1, moves: ['7g7f'], score: 42 }], metrics: { nodes: 1234 } } }];
  const payload = { currentSfen: 'current', searches: [], engineNames: {}, thinkingHistory: history };
  const onAction = vi.fn();
  const view = render(<EngineThinking payload={payload} onHistoryAction={onAction} />);
  fireEvent.click(view.getByRole('button', { name: 'Search history (1)' }));
  expect(view.getByText('Search finished · Earlier position')).toBeTruthy();
  expect(view.getByText('1,234')).toBeTruthy();
  view.rerender(<EngineThinking payload={{ ...payload, thinkingHistory: [{ ...history[0], id: 'two', engineName: 'New engine' }, ...history] }} onHistoryAction={onAction} />);
  expect((view.getByLabelText('Saved search') as HTMLSelectElement).value).toBe('one');
  fireEvent.click(view.getByRole('button', { name: 'Preview candidate 1' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'thinking-preview', id: 'one', rank: 1 });
  fireEvent.change(view.getByLabelText('Saved search'), { target: { value: 'two' } });
  expect(view.getByRole('heading', { name: 'New engine' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Clear finished history' }));
  expect(onAction).toHaveBeenLastCalledWith({ type: 'thinking-clear' });
});
it('shows stopped metric-only history without claiming that it is still searching', () => {
  const view = render(<EngineThinking payload={{ searches: [], engineNames: {}, currentSfen: 'root', thinkingHistory: [{ id: 'one', source: 'analysis', engineName: 'A', startedAt: 1000, status: 'stopped', search: { engineId: 'a', rootSfen: 'root', complete: false, lines: [], metrics: { depth: 4 } } }] }} />);
  fireEvent.click(view.getByRole('button', { name: 'Search history (1)' }));
  expect(view.getByText('Search stopped')).toBeTruthy();
  expect(view.getByText('No continuation reported for this search.')).toBeTruthy();
});
