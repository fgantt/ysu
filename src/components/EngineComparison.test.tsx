import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { EngineComparison } from './EngineComparison';
import { emptyComparison, type ComparisonState } from '../usi/engineComparison';
const root = InitialPositionSFEN.STANDARD;
const engines = [{ id: 'a', name: 'A', maxCandidates: 5 }, { id: 'b', name: 'B', maxCandidates: 1 }];
afterEach(cleanup);
describe('comparison controls and results', () => {
  it('selects two enabled engines and requests a shared supported budget', () => {
    const onAction = vi.fn();
    const view = render(<EngineComparison state={emptyComparison()} engines={engines} currentSfen={root} onAction={onAction} onPreview={vi.fn()} />);
    view.getByRole('button', { name: 'Compare position' }).click();
    expect(onAction).toHaveBeenCalledWith({ type: 'comparison-start', engineIds: ['a', 'b'], seconds: 5, candidates: 1 });
    expect((view.getByLabelText('Candidates per engine') as HTMLSelectElement).options).toHaveLength(1);
  });
  it('normalizes score differences, marks earlier positions and previews the captured root', () => {
    const goteRoot = root.replace(' b ', ' w ');
    const state: ComparisonState = { version: 1, busy: false, rootSfen: goteRoot, seconds: 1, candidates: 1, engines: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], sides: [
      { status: 'complete', search: { engineId: 'instance-a', rootSfen: goteRoot, complete: true, lines: [{ rank: 1, score: 100, moves: ['3c3d'] }] } },
      { status: 'complete', search: { engineId: 'instance-b', rootSfen: goteRoot, complete: true, lines: [{ rank: 1, score: 40, moves: ['8c8d'] }] } },
    ] };
    const onPreview = vi.fn();
    const view = render(<EngineComparison state={state} engines={engines} currentSfen={root} onAction={vi.fn()} onPreview={onPreview} />);
    expect(view.getByText(/left minus right score: -60 cp/)).toBeTruthy();
    expect(view.getByRole('status').textContent).toContain('Earlier captured position');
    view.getAllByRole('button', { name: /Preview continuation/ })[0].click();
    expect(onPreview).toHaveBeenCalledWith({ rootSfen: goteRoot, moves: ['3c3d'], step: 0, pinned: true, source: 'A candidate 1' });
    view.rerender(<EngineComparison state={{ ...state, sides: [{ ...state.sides[0], search: { ...state.sides[0].search!, lines: [{ rank: 1, mate: 5, moves: ['3c3d'] }] } }, state.sides[1]] }} engines={engines} currentSfen={root} onAction={vi.fn()} onPreview={onPreview} />);
    expect(view.getByText(/Numeric score difference unavailable/)).toBeTruthy();
    expect(view.getByRole('link').getAttribute('download')).toBe('shogi-engine-comparison.json');
  });
});


it('selects depth/node budgets and rejects invalid values', () => {
  const onAction = vi.fn();
  const view = render(<EngineComparison state={emptyComparison()} engines={engines} currentSfen={root} onAction={onAction} onPreview={vi.fn()} />);
  fireEvent.change(view.getByLabelText('Search budget'), { target: { value: 'depth' } });
  fireEvent.change(view.getByLabelText('Depth per engine'), { target: { value: '8' } });
  fireEvent.click(view.getByRole('button', { name: 'Compare position' }));
  expect(onAction).toHaveBeenLastCalledWith({ type: 'comparison-start', engineIds: ['a', 'b'], seconds: 60, candidates: 1, budget: { kind: 'depth', value: 8 } });
  fireEvent.change(view.getByLabelText('Search budget'), { target: { value: 'nodes' } });
  fireEvent.change(view.getByLabelText('Nodes per engine'), { target: { value: '100000' } });
  fireEvent.click(view.getByRole('button', { name: 'Compare position' }));
  expect(onAction).toHaveBeenLastCalledWith({ type: 'comparison-start', engineIds: ['a', 'b'], seconds: 60, candidates: 1, budget: { kind: 'nodes', value: 100000 } });
  fireEvent.change(view.getByLabelText('Nodes per engine'), { target: { value: '0' } });
  expect((view.getByRole('button', { name: 'Compare position' }) as HTMLButtonElement).disabled).toBe(true);
});

it('labels restored results and their original budget even on a different board position', () => {
  const state: ComparisonState = { ...emptyComparison(), restored: true, rootSfen: root, seconds: 60, budget: { kind: 'depth', value: 8 }, candidates: 1, engines: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], sides: [{ status: 'stopped' }, { status: 'error' }] };
  const view = render(<EngineComparison state={state} engines={engines} currentSfen={root.replace(' b ', ' w ')} onAction={vi.fn()} onPreview={vi.fn()} />);
  expect(view.getByRole('status').textContent).toContain('Saved comparison restored');
  expect(view.getByRole('status').textContent).toContain('depth 8');
  expect(view.getByRole('status').textContent).toContain('Earlier captured position');
});
