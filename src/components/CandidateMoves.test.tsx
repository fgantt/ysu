import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { CandidateMoves, type CandidatePayload } from './CandidateMoves';

// Keep UI tests focused on navigation; legal board replay has separate regression tests.
vi.mock('./Board', () => ({ default: ({ position }: { position: { sfen: string } }) => <div data-testid="preview-position">{position.sfen}</div> }));
vi.mock('./CapturedPieces', () => ({ default: () => <div>Pieces in hand</div> }));
afterEach(cleanup);
const payload: CandidatePayload = {
  currentSfen: InitialPositionSFEN.STANDARD,
  engineNames: { engine: 'Test Engine' },
  searches: [{ engineId: 'engine', rootSfen: InitialPositionSFEN.STANDARD, complete: true, lines: [
    { rank: 1, moves: ['7g7f', '3c3d'], score: 100, depth: 10 },
    { rank: 2, moves: ['2g2f', '8c8d'], score: 70, depth: 10 },
  ] }],
};

describe('Candidate Moves', () => {
  it('steps the independent preview and resets when choosing another candidate', () => {
    const { getByRole, getByText, getByTestId } = render(<CandidateMoves payload={payload} isVisible onToggle={vi.fn()} />);
    expect(getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    act(() => getByRole('button', { name: 'Next' }).click());
    expect(getByText('Move 1 / 2')).toBeTruthy();
    expect(getByTestId('preview-position').textContent).not.toBe(payload.currentSfen);
    expect(payload.currentSfen).toBe(InitialPositionSFEN.STANDARD);
    act(() => getByRole('button', { name: /#2 2g2f/ }).click());
    expect(getByText('Move 0 / 2')).toBeTruthy();
    expect(getByTestId('preview-position').textContent).toBe(payload.currentSfen);
  });

  it('marks earlier positions and reports the absence of analysis honestly', () => {
    const { getByText, rerender } = render(<CandidateMoves payload={{ ...payload, currentSfen: 'different' }} isVisible onToggle={vi.fn()} />);
    expect(getByText('These lines describe an earlier searched position.')).toBeTruthy();
    rerender(<CandidateMoves payload={{ ...payload, searches: [] }} isVisible onToggle={vi.fn()} />);
    expect(getByText(/Waiting for an engine/)).toBeTruthy();
  });

  it('supports minimize and native close actions', () => {
    const onToggle = vi.fn();
    const { getByRole, queryByRole, rerender } = render(<CandidateMoves payload={payload} isVisible={false} onToggle={onToggle} />);
    expect(queryByRole('button')).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
    rerender(<CandidateMoves payload={payload} isVisible onToggle={onToggle} externalWindow />);
    act(() => getByRole('button', { name: 'Close Candidate Moves window' }).click());
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('pins a continuation while engine output changes', () => {
    const { getByRole, getByText, getByTestId, rerender } = render(<CandidateMoves payload={payload} isVisible onToggle={vi.fn()} />);
    act(() => getByRole('button', { name: 'Pin continuation' }).click());
    act(() => getByRole('button', { name: 'Next' }).click());
    const sfen = getByTestId('preview-position').textContent;
    const updated = { ...payload, searches: [{ ...payload.searches[0], lines: [{ rank: 1, moves: ['2g2f', '8c8d'], score: 200 }] }] };
    rerender(<CandidateMoves payload={updated} isVisible onToggle={vi.fn()} />);
    expect(getByText('Move 1 / 2')).toBeTruthy();
    expect(getByTestId('preview-position').textContent).toBe(sfen);
    act(() => getByRole('button', { name: 'Unpin continuation' }).click());
    expect(getByText('Move 0 / 2')).toBeTruthy();
  });

  it('requests dedicated analysis with supported settings and the displayed root', () => {
    const onAction = vi.fn();
    const next = { ...payload, analysis: { status: 'idle' as const }, analysisEngines: [{ id: 'analysis', name: 'Analysis engine', maxCandidates: 5 }] };
    const { getByRole, rerender } = render(<CandidateMoves payload={next} isVisible onToggle={vi.fn()} onAnalysisAction={onAction} />);
    act(() => getByRole('button', { name: 'Analyze position' }).click());
    expect(onAction).toHaveBeenCalledWith({ type: 'start', engineId: 'analysis', rootSfen: payload.currentSfen, candidates: 3, seconds: 5 });
    rerender(<CandidateMoves payload={{ ...next, analysis: { status: 'running' } }} isVisible onToggle={vi.fn()} onAnalysisAction={onAction} />);
    expect(getByRole('button', { name: 'Analyze position' }).hasAttribute('disabled')).toBe(true);
    act(() => getByRole('button', { name: 'Stop analysis' }).click());
    expect(onAction).toHaveBeenLastCalledWith({ type: 'stop' });
  });

});


it('offers shared reuse and explicit engine release without changing the start action', () => {
  const onAction = vi.fn();
  const next = { ...payload, analysis: { status: 'complete' as const, reuseEnabled: true, engineReady: true, engineRetained: true, reused: true }, analysisEngines: [{ id: 'analysis', name: 'Analysis engine', maxCandidates: 5 }] };
  const view = render(<CandidateMoves payload={next} isVisible onToggle={vi.fn()} onAnalysisAction={onAction} />);
  expect((view.getByRole('checkbox', { name: 'Keep analysis engine ready between searches' }) as HTMLInputElement).checked).toBe(true);
  expect(view.getByText('Analysis engine ready for the next position.')).toBeTruthy();
  expect(view.getByText('This search reused the analysis engine.')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Close analysis engine' }));
  expect(onAction).toHaveBeenLastCalledWith({ type: 'release' });
  fireEvent.click(view.getByRole('checkbox', { name: 'Keep analysis engine ready between searches' }));
  expect(onAction).toHaveBeenLastCalledWith({ type: 'reuse', enabled: false });
  view.rerender(<CandidateMoves payload={{ ...next, analysis: { ...next.analysis, status: 'running' } }} isVisible onToggle={vi.fn()} onAnalysisAction={onAction} />);
  expect((view.getByRole('checkbox', { name: 'Keep analysis engine ready between searches' }) as HTMLInputElement).disabled).toBe(true);
  expect((view.getByRole('button', { name: 'Close analysis engine' }) as HTMLButtonElement).disabled).toBe(true);
});
