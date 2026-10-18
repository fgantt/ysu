import { Position, Record as ShogiRecord, exportKIF } from 'tsshogi';

export interface VariationNode { id: string; move: string | null; sfen: string; source?: string; comment?: string; children: VariationNode[] }
export interface VariationStudy { version: 1; roots: VariationNode[]; selectedId: string | null }
export const VARIATION_STORAGE_KEY = 'shogi-variation-study';
export const emptyStudy = (): VariationStudy => ({ version: 1, roots: [], selectedId: null });
const MAX_NODES = 2000;
const MAX_DEPTH = 256;

export function variationPath(study: VariationStudy, id: string): VariationNode[] | null {
  const visit = (nodes: VariationNode[], path: VariationNode[]): VariationNode[] | null => {
    for (const node of nodes) {
      const next = [...path, node];
      if (node.id === id) return next;
      const found = visit(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return visit(study.roots, []);
}

/** Validate the whole line before inserting; illegal suffixes never leave partial branches. */
export function saveVariation(study: VariationStudy, rootSfen: string, moves: string[], source: string): VariationStudy {
  const position = Position.newBySFEN(rootSfen);
  if (!position) throw new Error('Invalid starting position.');
  if (moves.length > MAX_DEPTH) throw new Error('A variation may contain at most 256 moves.');
  const positions = [position.sfen];
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`Illegal move: ${usi}`);
    positions.push(position.sfen);
  }
  const next: VariationStudy = JSON.parse(JSON.stringify(study));
  const root = next.roots.find(value => value.sfen === positions[0]);
  let node: VariationNode = root ?? { id: crypto.randomUUID(), move: null, sfen: positions[0], source, children: [] };
  if (!root) next.roots.push(node);
  for (let index = 0; index < moves.length; index++) {
    let child: VariationNode | undefined = node.children.find(value => value.move === moves[index]);
    if (!child) { child = { id: crypto.randomUUID(), move: moves[index], sfen: positions[index + 1], source, children: [] }; node.children.push(child); }
    node = child;
  }
  next.selectedId = node.id;
  let count = 0;
  const countNodes = (nodes: VariationNode[]) => { for (const value of nodes) { count++; countNodes(value.children); } };
  countNodes(next.roots);
  if (count > MAX_NODES) throw new Error('The study may contain at most 2000 positions.');
  return next;
}

export function removeVariation(study: VariationStudy, id: string): VariationStudy {
  const path = variationPath(study, id);
  if (!path) return study;
  const prune = (nodes: VariationNode[]): VariationNode[] => nodes.filter(node => node.id !== id).map(node => ({ ...node, children: prune(node.children) }));
  const roots = prune(study.roots);
  const next: VariationStudy = { ...study, roots };
  next.selectedId = study.selectedId && variationPath(next, study.selectedId) ? study.selectedId : path.at(-2)?.id ?? null;
  return next;
}

/** Never trust cached/imported SFENs: reconstruct every child from its parent. */
export function parseVariationStudy(text: string): VariationStudy {
  if (text.length > 2_000_000) throw new Error('Study file is too large.');
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.roots)) throw new Error('Unsupported variation study.');
  const ids = new Set<string>();
  const visit = (raw: unknown, parent: Position | null, depth: number): VariationNode => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid variation node.');
    const node = raw as Record<string, unknown>;
    if (depth > MAX_DEPTH || ids.size >= MAX_NODES || typeof node.id !== 'string' || !node.id || ids.has(node.id) || !Array.isArray(node.children)) throw new Error('Invalid or oversized variation tree.');
    ids.add(node.id);
    let position: Position | null;
    if (!parent) {
      if (node.move !== null || typeof node.sfen !== 'string') throw new Error('Invalid study root.');
      position = Position.newBySFEN(node.sfen);
    } else {
      position = Position.newBySFEN(parent.sfen);
      if (!position || typeof node.move !== 'string') throw new Error('Invalid branch move.');
      const move = position.createMoveByUSI(node.move);
      if (!move || !position.doMove(move)) throw new Error(`Illegal branch move: ${node.move}`);
    }
    if (!position || node.sfen !== position.sfen) throw new Error('Study position does not match its moves.');
    if (node.comment !== undefined && (typeof node.comment !== 'string' || node.comment.length > 10000)) throw new Error('Invalid or oversized position comment.');
    const moves = new Set<unknown>();
    const children = node.children.map(child => {
      const parsed = visit(child, position, depth + 1);
      if (moves.has(parsed.move)) throw new Error('Duplicate branch move.');
      moves.add(parsed.move);
      return parsed;
    });
    return { comment: node.comment as string | undefined, id: node.id, move: node.move as string | null, sfen: position.sfen, source: typeof node.source === 'string' ? node.source.slice(0, 300) : undefined, children };
  };
  const roots = data.roots.map((root: unknown) => visit(root, null, 0));
  if (new Set(roots.map((root: VariationNode) => root.sfen)).size !== roots.length) throw new Error('Duplicate starting position.');
  if (data.selectedId !== null && (typeof data.selectedId !== 'string' || !ids.has(data.selectedId))) throw new Error('Invalid selected position.');
  return { version: 1, roots, selectedId: data.selectedId };
}

/** Comments are optional so existing version-one studies remain compatible. */
export function commentVariation(study: VariationStudy, id: string, comment: string): VariationStudy {
  if (comment.length > 10000) throw new Error('A position comment may contain at most 10000 characters.');
  if (!variationPath(study, id)) throw new Error('The selected position no longer exists.');
  const update = (nodes: VariationNode[]): VariationNode[] => nodes.map(node => ({ ...node, comment: node.id === id ? comment : node.comment, children: update(node.children) }));
  const next = { ...study, roots: update(study.roots) };
  if (JSON.stringify(next).length > 2_000_000) throw new Error('Study file is too large. Shorten this comment before saving.');
  return next;
}

/** KIF contains one starting position; export each independent root separately. */
export function exportVariationKif(study: VariationStudy, rootId: string): string {
  const validated = parseVariationStudy(JSON.stringify(study));
  const root = validated.roots.find(node => node.id === rootId);
  if (!root) throw new Error('Starting position not found.');
  const position = Position.newBySFEN(root.sfen)!;
  const record = new ShogiRecord();
  record.clear(position);
  record.current.comment = root.comment ?? '';
  const append = (nodes: VariationNode[]) => {
    const parent = record.current;
    for (const node of nodes) {
      if (!record.gotoNode(parent)) throw new Error('Could not restore branch position.');
      const move = record.position.createMoveByUSI(node.move!);
      if (!move || !record.append(move)) throw new Error('Could not export branch move.');
      record.current.comment = node.comment ?? '';
      append(node.children);
    }
    record.gotoNode(parent);
  };
  append(root.children);
  record.resetAllBranchSelection();
  record.goto(0);
  return exportKIF(record, { returnCode: '\n' });
}
