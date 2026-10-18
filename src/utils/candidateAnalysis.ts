import { Position, Square } from 'tsshogi';

export interface CandidateLine {
  rank: number;
  moves: string[];
  score?: number;
  mate?: number | '+' | '-';
  bound?: 'lowerbound' | 'upperbound';
  depth?: number;
  nodes?: number;
  nps?: number;
  time?: number;
}
export interface ThinkingMetrics {
  depth?: number; seldepth?: number; nodes?: number; nps?: number; time?: number; hashfull?: number; currentMove?: string;
}
export function parseThinkingMetrics(message: string): ThinkingMetrics {
  const tokens = message.trim().split(/\s+/);
  const metrics: ThinkingMetrics = {};
  if (tokens[0] !== 'info') return metrics;
  const numbers = ['depth', 'seldepth', 'nodes', 'nps', 'time', 'hashfull'] as const;
  for (let index = 1; index < tokens.length; index++) {
    const field = tokens[index];
    if (field === 'string' || field === 'pv') break;
    if (field === 'currmove') metrics.currentMove = tokens[++index];
    else if (numbers.includes(field as typeof numbers[number])) {
      const value = Number(tokens[++index]);
      if (Number.isSafeInteger(value) && value >= 0) metrics[field as typeof numbers[number]] = value;
    }
  }
  return metrics;
}

export interface CandidateSearch {
  searchId?: string;
  engineId: string;
  rootSfen: string;
  complete: boolean;
  lines: CandidateLine[];
  metrics?: ThinkingMetrics;
}

/** Parse only structured USI info; free-form strings are not analysis. */
export function parseCandidateLine(message: string): CandidateLine | null {
  const tokens = message.trim().split(/\s+/);
  if (tokens[0] !== 'info') return null;
  const line: CandidateLine = { rank: 1, moves: [] };
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'string') break;
    if (token === 'pv') {
      line.moves = tokens.slice(i + 1);
      break;
    }
    if (token === 'score') {
      const kind = tokens[++i];
      const value = tokens[++i];
      if (kind === 'cp' && /^-?\d+$/.test(value ?? '')) line.score = Number(value);
      if (kind === 'mate') {
        if (value === '+' || value === '-') line.mate = value;
        else if (/^-?\d+$/.test(value ?? '')) line.mate = Number(value);
      }
    } else if (token === 'lowerbound' || token === 'upperbound') line.bound = token;
    else if (['multipv', 'depth', 'nodes', 'nps', 'time'].includes(token)) {
      const value = Number(tokens[++i]);
      if (!Number.isFinite(value) || value < 0) continue;
      if (token === 'multipv') { if (Number.isInteger(value) && value >= 1) line.rank = value; }
      else if (token === 'depth') line.depth = value;
      else if (token === 'nodes') line.nodes = value;
      else if (token === 'nps') line.nps = value;
      else line.time = value;
    }
  }
  return line.moves.length ? line : null;
}

export function updateCandidateSearch(search: CandidateSearch, message: string): CandidateSearch {
  if (message.startsWith('bestmove ')) return { ...search, complete: true };
  if (search.complete) return search;
  const line = parseCandidateLine(message);
  const packet = parseThinkingMetrics(message);
  if (!line && Object.keys(packet).length === 0) return search;
  const previous = line ? search.lines.find(item => item.rank === line.rank) : undefined;
  // An older-depth packet must not overwrite a deeper result for this candidate.
  if (previous?.depth !== undefined && line?.depth !== undefined && line.depth < previous.depth) return search;
  const metrics = { ...search.metrics, ...packet };
  // Depth and total counters should not move backwards between MultiPV packets.
  for (const key of ['depth', 'seldepth', 'nodes', 'time'] as const) {
    if (search.metrics?.[key] !== undefined && metrics[key] !== undefined) metrics[key] = Math.max(search.metrics[key]!, metrics[key]!);
  }
  return { ...search, metrics, lines: line ? [...search.lines.filter(item => item.rank !== line.rank), line].sort((a, b) => a.rank - b.rank) : search.lines };
}

export function candidateScore(line: CandidateLine, rootSfen: string): string {
  const sign = rootSfen.split(' ')[1] === 'w' ? -1 : 1;
  const bound = line.bound ? ` (${line.bound === 'lowerbound' ? 'lower' : 'upper'} bound for the searching side)` : '';
  if (line.mate !== undefined) {
    const winning = typeof line.mate === 'number' ? line.mate >= 0 : line.mate === '+';
    const winner = winning === (sign === 1) ? 'Sente' : 'Gote';
    return `${winner} mate${typeof line.mate === 'number' ? ` in ${Math.abs(line.mate)}` : ''}${bound}`;
  }
  if (line.score === undefined) return 'Score unavailable';
  const score = sign * line.score;
  return `${score > 0 ? '+' : ''}${score} cp${bound}`;
}

/** Replay on an independent position; stop at the first illegal or unavailable move. */
export function replayContinuation(rootSfen: string, moves: string[], count: number) {
  const position = Position.newBySFEN(rootSfen);
  if (!position) return null;
  let applied = 0;
  let lastMove: { from: Square | null; to: Square } | null = null;
  for (const usi of moves.slice(0, Math.max(0, count))) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) break;
    lastMove = { from: move.from instanceof Square ? move.from : null, to: move.to };
    applied++;
  }
  return { position, applied, lastMove, invalid: applied < Math.min(Math.max(0, count), moves.length) };
}
