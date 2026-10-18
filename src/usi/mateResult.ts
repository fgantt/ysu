import { Position, Square } from 'tsshogi';
export type MateReply = { kind: 'found'; moves: string[] } | { kind: 'nomate' | 'timeout' | 'unsupported' };
export function parseMateReply(message: string): MateReply | null {
  const tokens = message.trim().split(/\s+/);
  if (tokens[0] !== 'checkmate') return null;
  if (tokens.length === 2 && ['nomate', 'timeout', 'notimplemented'].includes(tokens[1])) return { kind: tokens[1] === 'notimplemented' ? 'unsupported' : tokens[1] as 'nomate' | 'timeout' };
  if (tokens.length < 2 || tokens.length > 257 || tokens.slice(1).some(move => !/^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/.test(move))) throw new Error('The engine returned a malformed checkmate line.');
  return { kind: 'found', moves: tokens.slice(1) };
}
function hasLegalReply(position: Position): boolean {
  for (const from of Square.all) {
    if (position.board.at(from)?.color !== position.color) continue;
    for (const to of Square.all) {
      const move = position.createMove(from, to);
      if (move && (position.isValidMove(move) || position.isValidMove(move.withPromote()))) return true;
    }
  }
  for (const { type, count } of position.hand(position.color).counts) {
    if (!count) continue;
    for (const to of Square.all) {
      const move = position.createMove(type, to);
      if (move && position.isValidMove(move)) return true;
    }
  }
  return false;
}
/** Validate the principal line, not all alternative defenses in the engine's proof. */
export function validateMateLine(rootSfen: string, moves: string[]): void {
  const position = Position.newBySFEN(rootSfen);
  if (!position || moves.length === 0 || moves.length > 256 || moves.length % 2 === 0) throw new Error('A mate line must end with a move by the searching side.');
  for (let index = 0; index < moves.length; index++) {
    const move = position.createMoveByUSI(moves[index]);
    if (!move || !position.doMove(move)) throw new Error(`The engine returned an illegal mate move: ${moves[index]}`);
    if (index % 2 === 0 && !position.checked) throw new Error('The reported mate line contains a non-checking attacking move.');
  }
  if (!position.checked || hasLegalReply(position)) throw new Error('The reported line does not end in checkmate.');
}
