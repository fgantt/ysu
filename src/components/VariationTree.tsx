import AnalysisInstructions from './AnalysisInstructions';
import { useEffect, useState } from 'react';
import type { ContinuationState } from './ContinuationBoard';
import { exportVariationKif, variationPath, type VariationNode, type VariationStudy } from '../utils/variationTree';
import './VariationTree.css';
import { studyGameBranch } from '../utils/studyGame';

export type VariationAction = { type: 'variation-load-game'; id: string; key: string } | { type: 'variation-comment'; id: string; comment: string } | { type: 'variation-board-add'; rootSfen: string; prefix: string[]; move: string } | { type: 'variation-undo' } | { type: 'variation-save' } | { type: 'variation-select'; id: string } | { type: 'variation-remove'; id: string } | { type: 'variation-add'; move: string } | { type: 'variation-import'; text: string };
interface Props { study: VariationStudy; continuation?: ContinuationState | null; error?: string; canUndo?: boolean; canLoadGame?: boolean; onAction: (action: VariationAction) => void }
export function VariationTree({ study, continuation, error, canUndo, canLoadGame, onAction }: Props) {
  const selected = study.selectedId ? variationPath(study, study.selectedId)?.at(-1) : undefined;
  const [comment, setComment] = useState('');
  useEffect(() => { setComment(selected?.comment ?? ''); }, [selected?.id, selected?.comment]);
  const [exportError, setExportError] = useState('');
  const [kif, setKif] = useState<{ text: string; index: number } | null>(null);
  const [move, setMove] = useState('');
  const [importText, setImportText] = useState('');
  useEffect(() => { setKif(null); }, [study]);
  const [transferVisible, setTransferVisible] = useState(false);
  const nodes = (values: VariationNode[], depth: number) => <ul>{values.map((node, index) => <li key={node.id}>
    <button aria-pressed={study.selectedId === node.id} title={node.source} onClick={() => onAction({ type: 'variation-select', id: node.id })}>{depth === 0 ? `Starting position ${index + 1}` : `${depth}. ${node.move}`}</button>
    {node.comment && <span title={node.comment} aria-label="Has comment"> ✎</span>}
    {node.children.length > 0 && nodes(node.children, depth + 1)}
  </li>)}</ul>;
  return <section className="variation-tree" aria-label="Variation Tree">
    <h4>Variation Tree</h4><AnalysisInstructions guide="variation" windowControls={false} /><p>Saved branches belong to this study. Selecting or editing them does not change the game.</p>
    <div className="variation-actions"><button disabled={!canUndo} onClick={() => onAction({ type: 'variation-undo' })}>Undo tree edit</button><button disabled={!continuation} onClick={() => onAction({ type: 'variation-save' })}>Save preview line</button><button disabled={!study.selectedId} onClick={() => study.selectedId && onAction({ type: 'variation-remove', id: study.selectedId })}>Remove selected branch</button></div>
    {canLoadGame && <button disabled={!selected} onClick={() => {
      try {
        const branch = studyGameBranch(study, selected!.id);
        setExportError('');
        onAction({ type: 'variation-load-game', id: selected!.id, key: branch.key });
      } catch (error) { setExportError(error instanceof Error ? error.message : 'Could not prepare this branch.'); }
    }}>Load selected branch as game…</button>}
    {exportError && !transferVisible && <p role="alert">{exportError}</p>}
    {continuation && <form onSubmit={event => { event.preventDefault(); if (move.trim()) { onAction({ type: 'variation-add', move: move.trim() }); setMove(''); } }}>
      <label>Branch move (USI)<input value={move} placeholder="7g7f or P*5e" onChange={event => setMove(event.target.value)} /></label><button disabled={!move.trim()} type="submit">Add from preview position</button>
      <small>Adds a legal move at preview step {continuation.step}.</small>
    </form>}
    {selected && <form onSubmit={event => { event.preventDefault(); onAction({ type: 'variation-comment', id: selected.id, comment }); }}>
      <label>Selected position comment<textarea maxLength={10000} value={comment} onChange={event => setComment(event.target.value)} /></label>
      <button type="submit" disabled={comment === (selected.comment ?? '')}>Save comment</button><small>Comments are saved with the study and included in KIF export. Save before selecting another position.</small>
    </form>}
    {error && <p role="alert">{error}</p>}
    {study.roots.length ? <nav aria-label="Saved variations">{nodes(study.roots, 0)}</nav> : <p>No saved branches yet. Select a candidate and save its line.</p>}
    <button onClick={() => setTransferVisible(value => !value)}>Import / export study</button>
    {transferVisible && <div className="variation-transfer">
      <a download="shogi-variation-study.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(study))}`}>Download study JSON</a>
      <p>KIF exports one starting position and all its branches per file (UTF-8).</p>
      {study.roots.map((root, index) => <button key={root.id} onClick={() => { try { setKif({ text: exportVariationKif(study, root.id), index: index + 1 }); setExportError(''); } catch (error) { setKif(null); setExportError(error instanceof Error ? error.message : 'Could not export KIF.'); } }}>Prepare KIF for starting position {index + 1}</button>)}
      {exportError && <p role="alert">{exportError}</p>}
      {kif && <div><a download={`shogi-study-position-${kif.index}.kif`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(kif.text)}`}>Download KIF</a><label>Exported KIF<textarea readOnly value={kif.text} /></label></div>}
      <label>Exported study JSON<textarea readOnly value={JSON.stringify(study)} /></label>
      <label>Import study JSON<textarea value={importText} onChange={event => setImportText(event.target.value)} /></label>
      <p>Import replaces this study after all positions have been validated. Copy the exported JSON to keep a backup.</p>
      <button disabled={!importText.trim()} onClick={() => onAction({ type: 'variation-import', text: importText })}>Import study</button>
    </div>}
  </section>;
}
