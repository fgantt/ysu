import { useEffect, useRef } from 'react';
import { analysisMoveLabels } from '../utils/analysisNotation';
import type { GameData } from '../utils/gameFormats';
import type { StudyGameBranch } from '../utils/studyGame';
import './StudyGameImportDialog.css';
interface Props { branch: StudyGameBranch; currentGame: GameData; busy: boolean; error: string; onCancel: () => void; onLoad: () => void }
export function StudyGameImportDialog({ branch, currentGame, busy, error, onCancel, onLoad }: Props) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const labels = analysisMoveLabels(branch.rootSfen, branch.moves);
  return <div className="study-game-overlay"><section ref={dialog} className="study-game-dialog" role="dialog" aria-modal="true" aria-labelledby="study-game-title" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
    }}>
    <h2 id="study-game-title">Load study branch as game</h2>
    <p>This replaces the current game with the path from its study starting position through the selected node ({branch.moves.length} {branch.moves.length === 1 ? 'move' : 'moves'}). Both players will be human, hints will be off, and clocks will restart at 30 minutes. You can continue playing from the final position.</p>
    <p>The study and its other branches remain saved. Position comments are kept in the loaded record.</p>
    <a download="shogi-game-before-study.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(currentGame, null, 2))}`}>Download current game backup</a>
    <ol className="study-game-moves">{branch.moves.map((move, index) => <li key={index}>{labels[index]} <code>{move}</code></li>)}</ol>
    {!branch.moves.length && <p>Only the selected starting position will be loaded.</p>}
    <details><summary>Starting and final positions</summary><p>Starting SFEN</p><code>{branch.rootSfen}</code><p>Final SFEN</p><code>{branch.finalSfen}</code></details>
    {error && <p role="alert">{error}</p>}
    <div className="study-game-actions"><button autoFocus disabled={busy} onClick={onCancel}>Cancel</button><button disabled={busy} onClick={onLoad}>{busy ? 'Loading branch…' : 'Replace game with this branch'}</button></div>
  </section></div>;
}
