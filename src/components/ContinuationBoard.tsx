import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Square, type PieceType, type Move } from 'tsshogi';
import Board from './Board';
import CapturedPieces from './CapturedPieces';
import { replayContinuation } from '../utils/candidateAnalysis';
import { analysisMoveLabels } from '../utils/analysisNotation';
import './CandidateMoves.css';
import './ContinuationBoard.css';

export interface ContinuationState { rootSfen: string; moves: string[]; step: number; pinned: boolean; source: string }
export function continuationKey(value: Pick<ContinuationState, 'rootSfen' | 'moves'>) { return JSON.stringify([value.rootSfen, value.moves]); }
export function normalizeContinuation(value: ContinuationState): ContinuationState {
  return { ...value, step: Number.isFinite(value.step) ? Math.max(0, Math.min(value.moves.length, Math.floor(value.step))) : 0 };
}
export interface BoardVariationMove { rootSfen: string; prefix: string[]; move: string }
interface Props { onAddMove?: (value: BoardVariationMove) => void; value: ContinuationState; onStep: (step: number) => void; pieceThemeType?: string; boardBackground?: string }
export function ContinuationBoard({ value, onStep, pieceThemeType, boardBackground, onAddMove }: Props) {
  const preview = useMemo(() => replayContinuation(value.rootSfen, value.moves, value.step), [value.rootSfen, value.moves, value.step]);
  const fullLine = useMemo(() => replayContinuation(value.rootSfen, value.moves, value.moves.length), [value.rootSfen, value.moves]);
  const submitting = useRef(false);
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Square | PieceType | null>(null);
  const [promotion, setPromotion] = useState<Move | null>(null);
  useEffect(() => { submitting.current = false; setSelection(null); setPromotion(null); }, [value.rootSfen, value.moves, value.step, editing]);
  const labels = useMemo(() => analysisMoveLabels(value.rootSfen, value.moves), [value.rootSfen, value.moves]);
  const choices = (to: Square) => {
    if (!preview || selection === null) return [];
    const move = preview.position.createMove(selection, to);
    if (!move) return [];
    return [move, move.withPromote()].filter(candidate => preview.position.isValidMove(candidate));
  };
  const legalMoves = editing && selection !== null ? Square.all.filter(square => choices(square).length > 0) : [];
  const submit = (move: Move) => {
    if (submitting.current) return;
    submitting.current = true;
    queueMicrotask(() => { submitting.current = false; });
    onAddMove?.({ rootSfen: value.rootSfen, prefix: value.moves.slice(0, preview?.applied ?? 0), move: move.usi });
    setSelection(null); setPromotion(null);
  };
  const selectSquare = (row: number, col: number) => {
    if (!editing || !preview || promotion) return;
    const square = Square.newByXY(col, row);
    const piece = preview.position.board.at(square);
    if (piece?.color === preview.position.color) { setSelection(square); return; }
    const moves = choices(square);
    if (moves.length === 2) setPromotion(moves[0]);
    else if (moves.length === 1) submit(moves[0]);
  };
  if (!preview || !fullLine) return <p role="alert">The starting position could not be displayed.</p>;
  return <section className="candidate-continuation" aria-label="Continuation board">
    <h4>Continuation board</h4><p>{value.source}{value.pinned ? ' · Pinned line' : ''}. This preview does not change the game.</p>
    <div className="continuation-controls">
      <button disabled={preview.applied === 0} onClick={() => onStep(0)}>Start</button>
      <button disabled={preview.applied === 0} onClick={() => onStep(preview.applied - 1)}>Previous</button>
      <span aria-live="polite">Move {preview.applied} / {value.moves.length}</span>
      <button disabled={preview.applied >= fullLine.applied} onClick={() => onStep(preview.applied + 1)}>Next</button>
      <button disabled={preview.applied >= fullLine.applied} onClick={() => onStep(fullLine.applied)}>End</button>
    </div>
    {fullLine.invalid && <p role="alert">The continuation contains an illegal move. Navigation stops at the last valid position.</p>}
    <nav className="continuation-move-list" aria-label="Continuation moves">
      <button aria-label="Go to preview starting position" aria-current={preview.applied === 0 ? 'step' : undefined} onClick={() => onStep(0)}>Starting position</button>
      <ol>{value.moves.map((move, index) => <li key={`${index}-${move}`}>
        <button aria-label={`Go to preview move ${index + 1}: ${move}`} aria-current={preview.applied === index + 1 ? 'step' : undefined} disabled={index >= fullLine.applied} onClick={() => onStep(index + 1)}>{index + 1}. {labels[index]} ({move})</button>
      </li>)}</ol>
    </nav>
    {onAddMove && <label><input type="checkbox" checked={editing} onChange={event => setEditing(event.target.checked)} /> Enter variation on board</label>}
    {editing && <p>Select a piece or a piece in hand, then a highlighted square. Each move saves a branch at this preview position.</p>}
    {promotion && <div role="dialog" aria-label="Promotion choice"><p>Promote this piece?</p><button onClick={() => submit(promotion.withPromote())}>Promote</button><button onClick={() => submit(promotion)}>Do not promote</button><button onClick={() => setPromotion(null)}>Cancel</button></div>}
    <div className="continuation-hands"><CapturedPieces captured={preview.position.hand(Color.WHITE)} player="player2" onPieceClick={editing && preview.position.color === Color.WHITE ? type => setSelection(type) : undefined} selectedCapturedPiece={typeof selection === 'string' ? selection : null} pieceThemeType={pieceThemeType} /><CapturedPieces captured={preview.position.hand(Color.BLACK)} player="player1" onPieceClick={editing && preview.position.color === Color.BLACK ? type => setSelection(type) : undefined} selectedCapturedPiece={typeof selection === 'string' ? selection : null} pieceThemeType={pieceThemeType} /></div>
    <div className="continuation-board" onDragStart={event => event.preventDefault()}><Board position={preview.position} onSquareClick={selectSquare} selectedSquare={selection instanceof Square ? selection : null} legalMoves={legalMoves} lastMove={preview.lastMove} pieceThemeType={pieceThemeType} boardBackground={boardBackground} showPieceTooltips /></div>
  </section>;
}
