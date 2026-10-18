import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN, Square, PieceType } from 'tsshogi';
import { ContinuationBoard, type ContinuationState } from './ContinuationBoard';
vi.mock('./Board', () => ({ default: ({ onSquareClick, legalMoves }: { onSquareClick: (row: number, col: number) => void; legalMoves: Square[] }) => <div>{Square.all.map(square => <button key={square.usi} aria-label={square.usi} data-legal={legalMoves.some(move => move.equals(square))} onClick={() => onSquareClick(square.y, square.x)}>{square.usi}</button>)}</div> }));
vi.mock('./CapturedPieces', () => ({ default: ({ onPieceClick }: { onPieceClick?: (type: PieceType) => void }) => onPieceClick ? <button onClick={() => onPieceClick(PieceType.PAWN)}>Drop pawn</button> : null }));
afterEach(cleanup);
const standard: ContinuationState = { rootSfen: InitialPositionSFEN.STANDARD, moves: [], step: 0, pinned: true, source: 'Test' };
function setup(value = standard) {
  const onAddMove = vi.fn();
  const view = render(<ContinuationBoard value={value} onStep={vi.fn()} onAddMove={onAddMove} />);
  fireEvent.click(view.getByRole('checkbox'));
  return { ...view, onAddMove };
}
describe('board variation entry', () => {
  it('highlights legal moves and sends an independent branch with its expected prefix', () => {
    const view = setup();
    fireEvent.click(view.getByRole('button', { name: '7g' }));
    expect(view.getByRole('button', { name: '7f' }).getAttribute('data-legal')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: '7e' }));
    expect(view.onAddMove).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: '7f' }));
    expect(view.onAddMove).toHaveBeenCalledWith({ rootSfen: standard.rootSfen, prefix: [], move: '7g7f' });
    expect(standard.moves).toEqual([]);
  });
  it('allows legal drops and rejects a pawn drop on the last rank', () => {
    const view = setup({ ...standard, rootSfen: '4k4/9/9/9/9/9/9/9/4K4 b P 1' });
    fireEvent.click(view.getByText('Drop pawn'));
    fireEvent.click(view.getByRole('button', { name: '7a' }));
    expect(view.onAddMove).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: '7c' }));
    expect(view.onAddMove.mock.calls[0][0].move).toBe('P*7c');
  });
  it('asks about optional promotion and forces required promotion', () => {
    const view = setup({ ...standard, rootSfen: '4k4/9/2P6/9/9/9/9/9/4K4 b - 1' });
    fireEvent.click(view.getByRole('button', { name: '7c' }));
    fireEvent.click(view.getByRole('button', { name: '7b' }));
    expect(view.getByRole('dialog', { name: 'Promotion choice' })).toBeTruthy();
    fireEvent.click(view.getByText('Promote', { exact: true }));
    expect(view.onAddMove.mock.calls[0][0].move).toBe('7c7b+');
    view.rerender(<ContinuationBoard value={{ ...standard, rootSfen: '4k4/2P6/9/9/9/9/9/9/4K4 b - 1' }} onStep={vi.fn()} onAddMove={view.onAddMove} />);
    fireEvent.click(view.getByRole('button', { name: '7b' }));
    fireEvent.click(view.getByRole('button', { name: '7a' }));
    expect(view.onAddMove.mock.calls[1][0].move).toBe('7b7a+');
  });
});
