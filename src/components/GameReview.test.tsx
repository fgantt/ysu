import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { GameReview } from './GameReview';
import { emptyReview, reviewPositions, type ReviewRow } from '../usi/gameReview';
afterEach(cleanup);
const record = { initialSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f'] };
const engine = { id: 'engine', name: 'Engine', display_name: 'Engine', enabled: true, is_favorite: true };
const row: ReviewRow = { ply: 1, move: '7g7f', side: 'Sente', rootSfen: record.initialSfen, afterSfen: 'after', before: 100, after: -100, loss: 200, bestLine: ['2g2f'] };
describe('Game Review', () => {
  it('starts with consistent settings and offers safe previews of flagged moves', () => {
    const start = vi.fn(); const preview = vi.fn();
    const { getByRole, getByText, container } = render(<GameReview state={{ ...emptyReview, status: 'complete', completed: 2, total: 2, record, rows: [row] }} record={record} engines={[engine]} onStart={start} onStop={vi.fn()} onPreview={preview} />);
    act(() => getByRole('button', { name: 'Review game' }).click());
    expect(start).toHaveBeenCalledWith('engine', 1, 'game');
    expect(getByText('Estimated loss: 200 cp')).toBeTruthy();
    expect(container.querySelector('.review-flagged')).toBeTruthy();
    act(() => getByRole('button', { name: 'Preview best line 1' }).click());
    expect(preview).toHaveBeenCalledWith(row, true);
  });
  it('offers Stop while review is running and identifies changed game snapshots', () => {
    const stop = vi.fn();
    const { getByRole, getByText } = render(<GameReview state={{ ...emptyReview, status: 'running', record, completed: 1, total: 2 }} record={{ ...record, moves: ['2g2f'] }} engines={[engine]} onStart={vi.fn()} onStop={stop} onPreview={vi.fn()} />);
    expect(getByRole('button', { name: 'Review game' }).hasAttribute('disabled')).toBe(true);
    act(() => getByRole('button', { name: 'Stop review' }).click());
    expect(stop).toHaveBeenCalledOnce();
    expect(getByText(/earlier snapshot/)).toBeTruthy();
  });
});

it('reviews a selected branch with two searches per move and forwards its scope', () => {
  const start = vi.fn();
  const view = render(<GameReview state={emptyReview} record={record} branch={{ ...record, moves: ['2g2f', '8c8d'] }} engines={[engine]} onStart={start} onStop={vi.fn()} onPreview={vi.fn()} />);
  fireEvent.change(view.getByLabelText('Review scope'), { target: { value: 'branch' } });
  expect(view.getByText(/4 searches/)).toBeTruthy();
  fireEvent.click(view.getByText('Review selected branch'));
  expect(start).toHaveBeenCalledWith('engine', 1, 'branch');
});

const navigationRecord = { ...record, moves: ['7g7f', '3c3d', '2g2f'] };
const positions = reviewPositions(navigationRecord);
const navigationRows: ReviewRow[] = navigationRecord.moves.map((move, index) => ({
  ...row, ply: index + 1, move, side: index % 2 ? 'Gote' : 'Sente',
  rootSfen: positions[index], afterSfen: positions[index + 1],
  loss: index === 1 ? 20 : 200, bestLine: [move], playedLine: [move],
}));
const navigationState = { ...emptyReview, status: 'complete' as const, record: navigationRecord, rows: navigationRows };
it('navigates captured positions with the chosen continuation and boundary controls', () => {
  const preview = vi.fn();
  const view = render(<GameReview state={navigationState} record={record} engines={[engine]} onStart={vi.fn()} onStop={vi.fn()} onPreview={preview} />);
  expect(preview).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'Previous reviewed move' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Show best continuation' }));
  fireEvent.click(view.getByRole('button', { name: 'Next reviewed move' }));
  expect(preview).toHaveBeenLastCalledWith(navigationRows[1], true);
  expect(view.getByText(positions[1])).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Last reviewed move' }));
  expect(preview).toHaveBeenLastCalledWith(navigationRows[2], true);
  expect(view.getByRole('button', { name: 'Next reviewed move' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Show played continuation' }));
  fireEvent.click(view.getByRole('button', { name: 'First reviewed move' }));
  expect(preview).toHaveBeenLastCalledWith(navigationRows[0], false);
});
it('navigates only flagged moves and falls back to the played line when no best line exists', () => {
  const preview = vi.fn();
  const view = render(<GameReview state={{ ...navigationState, rows: [navigationRows[0], navigationRows[1], { ...navigationRows[2], bestLine: [] }] }} record={record} engines={[engine]} onStart={vi.fn()} onStop={vi.fn()} onPreview={preview} />);
  fireEvent.click(view.getByRole('checkbox'));
  fireEvent.click(view.getByRole('button', { name: 'Show best continuation' }));
  fireEvent.click(view.getByRole('button', { name: 'Next reviewed move' }));
  expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 3 }), false);
  expect(view.getByRole('button', { name: 'Show best continuation' }).hasAttribute('disabled')).toBe(true);
  expect(view.getByText(/2 of 2 flagged reviewed moves/)).toBeTruthy();
});
it('supports direct selection and scoped keyboard navigation without reacting to background updates', () => {
  const preview = vi.fn();
  const props = { record, engines: [engine], onStart: vi.fn(), onStop: vi.fn(), onPreview: preview };
  const view = render(<GameReview {...props} state={{ ...navigationState, rows: navigationRows.slice(0, 2) }} />);
  fireEvent.change(view.getByLabelText('Reviewed move'), { target: { value: '2' } });
  expect(preview).toHaveBeenLastCalledWith(navigationRows[1], false);
  view.rerender(<GameReview {...props} state={navigationState} />);
  expect(preview).toHaveBeenCalledTimes(1);
  expect((view.getByLabelText('Reviewed move') as HTMLSelectElement).value).toBe('2');
  fireEvent.keyDown(view.getByRole('button', { name: 'Next reviewed move' }), { key: 'End' });
  expect(preview).toHaveBeenLastCalledWith(navigationRows[2], false);
  fireEvent.keyDown(view.getByLabelText('Reviewed move'), { key: 'Home' });
  expect(preview).toHaveBeenCalledTimes(2);
  view.rerender(<GameReview {...props} state={{ ...navigationState, record: { ...navigationRecord, moves: ['2g2f'] }, rows: [{ ...navigationRows[0], move: '2g2f' }] }} />);
  expect((view.getByLabelText('Reviewed move') as HTMLSelectElement).value).toBe('1');
  expect(preview).toHaveBeenCalledTimes(2);
});
it('hides navigation when a filter has no matching moves', () => {
  const view = render(<GameReview state={{ ...navigationState, rows: [{ ...row, loss: 20 }] }} record={record} engines={[engine]} onStart={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} />);
  fireEvent.click(view.getByRole('checkbox'));
  expect(view.queryByLabelText('Reviewed move')).toBeNull();
  expect(view.getByText(/No reviewed moves meet/)).toBeTruthy();
});
