import { useState } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN, type Square } from 'tsshogi';
import { ContinuationBoard, type ContinuationState } from './ContinuationBoard';
vi.mock('./Board', () => ({ default: ({ position, lastMove }: { position: { sfen: string }; lastMove: { from: Square | null; to: Square } | null }) => <div data-testid="board" data-highlight={lastMove ? `${lastMove.from?.usi ?? 'drop'}:${lastMove.to.usi}` : ''}>{position.sfen}</div> }));
vi.mock('./CapturedPieces', () => ({ default: () => null }));
afterEach(cleanup);
function Preview({ initial }: { initial: ContinuationState }) {
  const [value, setValue] = useState(initial);
  return <ContinuationBoard value={value} onStep={step => setValue({ ...value, step })} />;
}
const standard: ContinuationState = { rootSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f', '3c3d'], step: 0, pinned: true, source: 'Engine' };
describe('continuation move navigation and highlights', () => {
  it('jumps directly to moves and End, highlighting only the last previewed move', () => {
    const view = render(<Preview initial={standard} />);
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('');
    act(() => view.getByRole('button', { name: 'End' }).click());
    expect(view.getByText('Move 2 / 2')).toBeTruthy();
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('3c:3d');
    expect(view.getByRole('button', { name: 'Go to preview move 2: 3c3d' }).getAttribute('aria-current')).toBe('step');
    act(() => view.getByRole('button', { name: 'Go to preview move 1: 7g7f' }).click());
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('7g:7f');
    act(() => view.getByRole('button', { name: 'Go to preview starting position' }).click());
    expect(view.getByTestId('board').textContent).toBe(standard.rootSfen);
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('');
    expect(standard.step).toBe(0);
  });
  it('highlights drop destinations and promotion source/destination squares', () => {
    const view = render(<Preview initial={{ ...standard, rootSfen: '4k4/9/9/9/9/9/9/9/4K4 b P 1', moves: ['P*7c', '5a4a', '7c7b+'] }} />);
    act(() => view.getByRole('button', { name: 'Go to preview move 1: P*7c' }).click());
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('drop:7c');
    act(() => view.getByRole('button', { name: 'End' }).click());
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('7c:7b');
    expect(view.getByTestId('board').textContent).toContain('+P');
  });
  it('disables illegal suffix navigation and ends at the last legal position', () => {
    const view = render(<Preview initial={{ ...standard, moves: ['7g7f', '7g7f', '3c3d'] }} />);
    expect(view.getByRole('alert').textContent).toContain('illegal move');
    expect(view.getByRole('button', { name: 'Go to preview move 2: 7g7f' }).hasAttribute('disabled')).toBe(true);
    expect(view.getByRole('button', { name: 'Go to preview move 3: 3c3d' }).hasAttribute('disabled')).toBe(true);
    act(() => view.getByRole('button', { name: 'End' }).click());
    expect(view.getByText('Move 1 / 3')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('7g:7f');
    act(() => view.getByRole('button', { name: 'Previous' }).click());
    expect(view.getByText('Move 0 / 3')).toBeTruthy();
  });
  it('clears old move highlighting when the root and line change', () => {
    const view = render(<ContinuationBoard value={{ ...standard, step: 2 }} onStep={vi.fn()} />);
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('3c:3d');
    view.rerender(<ContinuationBoard value={{ ...standard, moves: ['2g2f'], step: 0 }} onStep={vi.fn()} />);
    expect(view.getByTestId('board').getAttribute('data-highlight')).toBe('');
    expect(view.queryByRole('button', { name: 'Go to preview move 2: 3c3d' })).toBeNull();
  });
});
