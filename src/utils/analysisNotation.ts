import { Position, formatMove, type Move } from 'tsshogi';

/** Format each move against its actual preceding position; retain unknown USI verbatim. */
export function analysisMoveLabels(rootSfen: string, moves: string[]): string[] {
  const position = Position.newBySFEN(rootSfen);
  let lastMove: Move | undefined;
  let valid = Boolean(position);
  return moves.map(usi => {
    if (!position || !valid) return usi;
    const move = position.createMoveByUSI(usi);
    if (!move || !position.isValidMove(move)) { valid = false; return usi; }
    const label = formatMove(position, move, { lastMove });
    position.doMove(move);
    lastMove = move;
    return label;
  });
}
