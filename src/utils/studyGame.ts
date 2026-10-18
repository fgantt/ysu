import { Move, Position, Record as ShogiRecord } from 'tsshogi';
import { variationPath, type VariationStudy } from './variationTree';

export interface StudyGameBranch {
  rootSfen: string;
  moves: string[];
  comments: string[];
  finalSfen: string;
  key: string;
}

/** Resolve only the path through the selected node, never its unselected descendants. */
export function studyGameBranch(study: VariationStudy, id: string): StudyGameBranch {
  const path = variationPath(study, id);
  if (!path) throw new Error('The selected study position no longer exists.');
  const rootSfen = path[0].sfen;
  const moves = path.slice(1).map(node => node.move!);
  const comments = path.map(node => node.comment ?? '');
  const record = createStudyGameRecord(rootSfen, moves, comments);
  for (let ply = 0; ply < path.length; ply++) {
    record.goto(ply);
    if (record.position.sfen !== path[ply].sfen) throw new Error('The saved branch contains an inconsistent position.');
  }
  return { rootSfen, moves, comments, finalSfen: record.position.sfen,
    key: JSON.stringify(path.map(node => [node.id, node.sfen, node.move, node.comment ?? ''])) };
}

/** Build and validate separately; callers replace their live record only after this succeeds. */
export function createStudyGameRecord(rootSfen: string, moves: string[], comments: string[] = []): ShogiRecord {
  if (moves.length > 256) throw new Error('A study branch may contain at most 256 moves.');
  const position = Position.newBySFEN(rootSfen);
  if (!position) throw new Error('Invalid study starting position.');
  const record = ShogiRecord.newByUSI(`sfen ${position.sfen}`);
  if (record instanceof Error) throw record;
  record.current.comment = comments[0] ?? '';
  for (const [index, usi] of moves.entries()) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`Illegal study move ${index + 1}: ${usi}`);
    const recordMove = record.position.createMoveByUSI(usi);
    if (!(recordMove instanceof Move) || !record.append(recordMove)) throw new Error(`Could not load study move ${index + 1}.`);
    record.current.comment = comments[index + 1] ?? '';
  }
  return record;
}
