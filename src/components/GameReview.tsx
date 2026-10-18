import { useState } from 'react';
import type { EngineConfig } from '../types/engine';
import { recordKey, reviewSnapshotKey, type ReviewRecord, type ReviewRow, type ReviewState } from '../usi/gameReview';
import './GameReview.css';
export type ReviewEngineChoice = Pick<EngineConfig, 'id' | 'name' | 'display_name' | 'enabled' | 'is_favorite'>;
interface Props { state: ReviewState; record: ReviewRecord; branch?: ReviewRecord; engines: ReviewEngineChoice[]; onStart: (engineId: string, seconds: number, scope?: 'game' | 'branch') => void; onStop: () => void; onPreview: (row: ReviewRow, best: boolean) => void }
export function GameReview({ state, record, branch, engines, onStart, onStop, onPreview }: Props) {
  const [scope, setScope] = useState<'game' | 'branch'>('game');
  const selectedRecord = scope === 'branch' && branch ? branch : record;
  const [engineId, setEngineId] = useState('');
  const [seconds, setSeconds] = useState(1);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [selection, setSelection] = useState<{ snapshot: string; ply: number }>();
  const [best, setBest] = useState(false);
  const snapshot = reviewSnapshotKey(state);
  const engine = engines.find(value => value.enabled && value.id === engineId) ?? engines.find(value => value.enabled && value.is_favorite) ?? engines.find(value => value.enabled);
  const busy = ['running', 'stopping'].includes(state.status);
  const rows = onlyFlagged ? state.rows.filter(row => row.loss !== undefined && row.loss >= 150) : state.rows;
  const selectedIndex = Math.max(0, rows.findIndex(row => selection?.snapshot === snapshot && row.ply === selection.ply));
  const selected = rows[selectedIndex];
  const preview = (row: ReviewRow, useBest: boolean) => {
    setSelection({ snapshot, ply: row.ply });
    setBest(useBest);
    onPreview(row, useBest);
  };
  const navigate = (index: number) => {
    const row = rows[index];
    if (row) preview(row, best && row.bestLine.length > 0);
  };
  const changed = state.record && recordKey(state.record) !== recordKey(selectedRecord);
  return <section aria-label="Game review">
    <p>For each move, searches the best continuation and the played move from the same starting position, with equal time and frozen engine settings. Loss estimates remain sensitive to search quality.</p>
    <div className="analysis-fields"><label>Review scope<select aria-label="Review scope" value={scope === 'branch' && !branch ? 'game' : scope} disabled={busy} onChange={event => setScope(event.target.value as 'game' | 'branch')}><option value="game">Current game</option><option value="branch" disabled={!branch?.moves.length}>Selected saved branch</option></select></label><label>Review engine<select aria-label="Review engine" value={engine?.id ?? ''} disabled={busy} onChange={event => setEngineId(event.target.value)}>{engines.filter(value => value.enabled).map(value => <option key={value.id} value={value.id}>{value.display_name || value.name}</option>)}</select></label>
      <label>Time per search<select aria-label="Review time per search" value={seconds} disabled={busy} onChange={event => setSeconds(Number(event.target.value))}>{[1, 3, 5, 10].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label></div>
    <p>{selectedRecord.moves.length * 2} searches · at least {selectedRecord.moves.length * 2 * seconds} seconds, plus engine startup time.</p>
    <div className="analysis-buttons"><button disabled={busy || !engine || !selectedRecord.moves.length} onClick={() => engine && onStart(engine.id, seconds, scope === 'branch' && branch ? 'branch' : 'game')}>{scope === 'branch' && branch ? 'Review selected branch' : 'Review game'}</button><button disabled={!busy || state.status === 'stopping'} onClick={onStop}>Stop review</button></div>
    <p role="status">{state.status === 'idle' ? 'No review yet' : `${state.status} · ${state.completed}/${state.total} searches`}{state.engineName ? ` · ${state.engineName} · ${state.seconds}s per search` : ''}</p>
    {state.record && <p>{state.method === 'forced' ? 'Direct comparison: best move versus restricted played-move search.' : 'Earlier review method: adjacent-position evaluation estimates.'}</p>}
    {changed && <p>This review describes an earlier snapshot. Run it again to include the current game.</p>}
    {state.error && <p role="alert">{state.error}</p>}
    <label><input type="checkbox" checked={onlyFlagged} onChange={event => setOnlyFlagged(event.target.checked)} /> Show moves with estimated loss of 150 cp or more</label>
    {selected && <div className="review-navigation" aria-label="Reviewed move navigation" onKeyDown={event => {
      if (event.target instanceof HTMLSelectElement || event.altKey || event.ctrlKey || event.metaKey) return;
      const index = event.key === 'ArrowLeft' ? Math.max(0, selectedIndex - 1) : event.key === 'ArrowRight' ? Math.min(rows.length - 1, selectedIndex + 1) : event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : undefined;
      if (index !== undefined) { event.preventDefault(); navigate(index); }
    }}>
      <div className="analysis-buttons">
        <button disabled={selectedIndex === 0} onClick={() => navigate(0)}>First reviewed move</button>
        <button disabled={selectedIndex === 0} onClick={() => navigate(selectedIndex - 1)}>Previous reviewed move</button>
        <button disabled={selectedIndex === rows.length - 1} onClick={() => navigate(selectedIndex + 1)}>Next reviewed move</button>
        <button disabled={selectedIndex === rows.length - 1} onClick={() => navigate(rows.length - 1)}>Last reviewed move</button>
      </div>
      <label>Reviewed move<select aria-label="Reviewed move" value={selected.ply} onChange={event => navigate(rows.findIndex(row => row.ply === Number(event.target.value)))}>{rows.map(row => <option key={row.ply} value={row.ply}>{row.ply}. {row.side} {row.move}</option>)}</select></label>
      <div className="analysis-buttons">
        <button aria-pressed={!(best && selected.bestLine.length > 0)} onClick={() => preview(selected, false)}>Show played continuation</button>
        <button aria-pressed={best && selected.bestLine.length > 0} disabled={!selected.bestLine.length} onClick={() => preview(selected, true)}>Show best continuation</button>
      </div>
      <p>Move {selected.ply} · {selected.side} · {selectedIndex + 1} of {rows.length}{onlyFlagged ? ' flagged reviewed moves' : ' reviewed moves'}. Previews start before the selected move and leave the main game unchanged.</p>
      <details><summary>Captured starting position</summary><code>{selected.rootSfen}</code></details>
      <small>With a navigation button focused, use ← / → or Home / End. Step through the line in Continuation Board.</small>
    </div>}
    <ol className="review-moves">{rows.map(row => <li key={row.ply} aria-current={selected?.ply === row.ply ? 'step' : undefined} className={row.loss !== undefined && row.loss >= 150 ? 'review-flagged' : ''}>
      <strong>{row.ply}. {row.side} {row.move}</strong><span>{row.loss !== undefined ? `Estimated loss: ${row.loss} cp` : 'Loss unavailable (missing, bounded or mate score)'}</span>
      <small>{state.method === 'forced' ? 'Best / played: ' : ''}{row.before !== undefined ? `${row.before > 0 ? '+' : ''}${row.before} cp` : 'Unavailable'} → {row.after !== undefined ? `${row.after > 0 ? '+' : ''}${row.after} cp` : 'Unavailable'} · Sente perspective</small>
      <div><button onClick={() => preview(row, false)}>Preview played move {row.ply}</button>{row.bestLine.length > 0 && <button onClick={() => preview(row, true)}>Preview best line {row.ply}</button>}</div>
    </li>)}</ol>
    {onlyFlagged && !rows.length && state.rows.length > 0 && <p>No reviewed moves meet this threshold.</p>}
  </section>;
}
