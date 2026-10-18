import { useThinkingHistory } from '../hooks/useThinkingHistory';
import { thinkingHistoryStore, type ThinkingAction } from '../utils/thinkingHistory';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { commentVariation, emptyStudy, parseVariationStudy, removeVariation, saveVariation, variationPath, VARIATION_STORAGE_KEY, type VariationStudy } from '../utils/variationTree';
import { studyGameBranch, type StudyGameBranch } from '../utils/studyGame';
import { VariationTree, type VariationAction } from './VariationTree';
import { useAnalysisSession } from '../hooks/useAnalysisSession';
import { useMateSearch } from '../hooks/useMateSearch';
import { MateSearch } from './MateSearch';
import { useEngineComparison } from '../hooks/useEngineComparison';
import { EngineComparison } from './EngineComparison';
import type { ComparisonAction } from '../usi/engineComparison';
import { useGameReview } from '../hooks/useGameReview';
import { maxCandidates, type AnalysisAction } from '../usi/analysisSession';
import { reviewSnapshotKey, type ReviewRecord, type ReviewRow } from '../usi/gameReview';
import type { EngineConfig } from '../types/engine';
import { SECONDARY_VIEW_OPEN_EVENT, toggleSecondaryView, secondaryViews, useSecondaryViewShortcuts, type SecondaryView } from './SecondaryViewMenu';
import { CandidateMoves, type CandidatePayload } from './CandidateMoves';
import { ContinuationBoard, normalizeContinuation, type ContinuationState } from './ContinuationBoard';
import { AnalysisPanelHost, AUXILIARY_ACTION_EVENT, CONTINUATION_CONFIG, THINKING_CONFIG, REVIEW_CONFIG, COMPARISON_CONFIG, MATE_CONFIG, type AuxiliaryAction } from './AnalysisPanel';
import { EngineThinking } from './EngineThinking';
import { GameReview } from './GameReview';
import { focusSecondaryPanel, SecondaryPanelFrame } from './SecondaryPanelFrame';
import { useSecondaryWindowHost, type SecondaryWindowConfig } from '../hooks/useSecondaryWindow';

export const CANDIDATE_WINDOW_CONFIG: SecondaryWindowConfig = {
  label: 'candidate-monitor', panelId: 'candidates', route: '/monitor/candidates', queryKey: 'analysis',
  updateEvent: 'candidate-monitor:analysis', closeEvent: 'candidate-monitor:closed',
  boundsKey: 'shogi-candidate-window-bounds', title: 'Candidate Moves', errorNoun: 'candidate moves',
  defaultWidth: 760, defaultHeight: 760, minWidth: 420, minHeight: 300,
};
export const ANALYSIS_ACTION_EVENT = 'candidate-monitor:action';
interface Props { onLoadStudyGame?: (branch: StudyGameBranch) => void; onOpenUsi?: () => void; onOpenEvaluation?: () => void; record: ReviewRecord; engines: EngineConfig[]; payload: CandidatePayload; isVisible: boolean; onToggle: () => void; onDismiss: () => void }
export function CandidateMovesHost({ payload, engines, record, isVisible, onToggle, onDismiss, onOpenUsi, onOpenEvaluation, onLoadStudyGame }: Props) {
  const thinkingHistory = useThinkingHistory();
  const { state, onAction } = useAnalysisSession(engines);
  const review = useGameReview(record, engines);
  const mate = useMateSearch(engines, payload.currentSfen);
  const [mateVisible, setMateVisible] = useState(false);
  const dismissMate = useCallback(() => setMateVisible(false), []);
  const comparison = useEngineComparison(engines, payload.currentSfen);
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const dismissComparison = useCallback(() => setComparisonVisible(false), []);
  const [continuation, setContinuation] = useState<ContinuationState | null>(null);
  const [restoredStudy] = useState(() => {
    try { const saved = localStorage.getItem(VARIATION_STORAGE_KEY); return { study: saved ? parseVariationStudy(saved) : emptyStudy(), error: '' }; }
    catch { return { study: emptyStudy(), error: 'The saved study could not be read. It has not been overwritten; import a valid backup or save a new line to start again.' }; }
  });
  const [variationStudy, setVariationStudy] = useState<VariationStudy>(restoredStudy.study);
  const [variationError, setVariationError] = useState(restoredStudy.error);
  const [variationHistory, setVariationHistory] = useState<VariationStudy[]>([]);
  const [detached, setDetached] = useState(false);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const updateContinuation = useCallback((value: ContinuationState) => setContinuation(normalizeContinuation(value)), []);
  const detach = useCallback(() => { setContinuation(value => value ? { ...value, pinned: true } : value); setDetached(true); }, []);
  const dismissContinuation = useCallback(() => setDetached(false), []);
  const dismissReview = useCallback(() => setReviewVisible(false), []);
  const dismissThinking = useCallback(() => setThinkingVisible(false), []);
  const embed = useCallback(() => {
    setDetached(false);
    void WebviewWindow.getByLabel(CONTINUATION_CONFIG.label).then(win => win?.close()).catch(console.error);
  }, []);
  const selectedPath = variationStudy.selectedId ? variationPath(variationStudy, variationStudy.selectedId) : null;
  const branchRecord = selectedPath ? { initialSfen: selectedPath[0].sfen, moves: selectedPath.slice(1).map(node => node.move!) } : undefined;
  const startReview = (engineId: string, seconds: number, scope?: 'game' | 'branch') => {
    if (scope === 'branch' && !branchRecord?.moves.length) return;
    review.start(engineId, seconds, scope === 'branch' ? branchRecord : record);
  };
  const analysisPayload: CandidatePayload = {
    ...payload, canLoadStudyGame: Boolean(onLoadStudyGame), analysis: state, mate: { state: mate.state, capabilities: mate.capabilities, engines: engines.filter(engine => engine.enabled).map(engine => ({ id: engine.id, name: engine.display_name || engine.name })) }, comparison: { state: comparison.state, engines: engines.filter(engine => engine.enabled).map(engine => ({ id: engine.id, name: engine.display_name || engine.name, maxCandidates: maxCandidates(engine) })) }, variationStudy, variationError, variationCanUndo: variationHistory.length > 0,
    review: { state: review.state, record, branch: branchRecord, engines: engines.map(({ id, name, display_name, enabled, is_favorite }) => ({ id, name, display_name, enabled, is_favorite })) }, continuation, continuationDetached: detached,
    searches: state.search ? [state.search] : payload.searches,
    engineNames: { ...payload.engineNames, ...(state.search ? { [state.search.engineId]: state.engineName ?? 'Analysis engine' } : {}) },
    analysisEngines: engines.filter(engine => engine.enabled).map(engine => ({ id: engine.id, name: engine.display_name || engine.name, maxCandidates: maxCandidates(engine) })),
  };
  const extraSearches = [review.state.search, ...comparison.state.sides.map(side => side.search)].filter((search): search is NonNullable<typeof search> => Boolean(search));
  const thinkingPayload = {
    ...analysisPayload, thinkingHistory, searches: [...payload.searches, ...(state.search ? [state.search] : []), ...extraSearches], engineNames: {
      ...analysisPayload.engineNames,
      ...(review.state.search ? { [review.state.search.engineId]: review.state.engineName ?? 'Review engine' } : {}),
      ...Object.fromEntries(comparison.state.sides.flatMap((side, index) => side.search ? [[side.search.engineId, comparison.state.engines?.[index].name ?? 'Comparison engine']] : [])),
    },
  };
  const thinkingAction = (action: ThinkingAction) => {
    if (action.type === 'thinking-clear') thinkingHistoryStore.clearFinished();
    else {
      const entry = thinkingHistoryStore.getSnapshot().find(item => item.id === action.id);
      const line = entry?.search.lines.find(item => item.rank === action.rank);
      if (entry && line) {
        updateContinuation({ rootSfen: entry.search.rootSfen, moves: [...line.moves], step: 0, pinned: true, source: `${entry.engineName} · Search history candidate ${line.rank}` });
        setDetached(true);
      }
    }
  };
  const previewReview = useCallback((row: ReviewRow, best: boolean) => {
    updateContinuation({ rootSfen: row.rootSfen, moves: best ? [...row.bestLine] : row.playedLine?.length ? [...row.playedLine] : [row.move], step: 0, pinned: true, source: `Review move ${row.ply} · ${best ? 'Engine line' : 'Played move'}` });
    setDetached(true);
  }, [updateContinuation]);
  const variationAction = (action: VariationAction) => {
    try {
      if (action.type === 'variation-load-game') {
        if (!onLoadStudyGame) throw new Error('Study game loading is unavailable.');
        const branch = studyGameBranch(variationStudy, action.id);
        if (variationStudy.selectedId !== action.id || branch.key !== action.key) throw new Error('The selected branch changed. Select it again before loading.');
        onLoadStudyGame(branch);
        setVariationError('');
        return;
      }
      let next = variationStudy;
      if (action.type === 'variation-undo') { next = variationHistory.at(-1) ?? next; setVariationHistory(values => values.slice(0, -1)); }
      else if (action.type === 'variation-save' && continuation) next = saveVariation(next, continuation.rootSfen, continuation.moves, continuation.source);
      else if (action.type === 'variation-add' && continuation) next = saveVariation(next, continuation.rootSfen, [...continuation.moves.slice(0, continuation.step), action.move], 'Manual branch');
      else if (action.type === 'variation-board-add') {
        if (!continuation || continuation.rootSfen !== action.rootSfen || JSON.stringify(continuation.moves.slice(0, continuation.step)) !== JSON.stringify(action.prefix)) throw new Error('The preview changed. Select your move again.');
        next = saveVariation(next, action.rootSfen, [...action.prefix, action.move], 'Board branch');
      }
      else if (action.type === 'variation-comment') next = commentVariation(next, action.id, action.comment);
      else if (action.type === 'variation-remove') next = removeVariation(next, action.id);
      else if (action.type === 'variation-import') next = parseVariationStudy(action.text);
      else if (action.type === 'variation-select' && variationPath(next, action.id)) next = { ...next, selectedId: action.id };
      const path = next.selectedId ? variationPath(next, next.selectedId) : null;
      if (path) updateContinuation({ rootSfen: path[0].sfen, moves: path.slice(1).map(node => node.move!), step: path.length - 1, pinned: true, source: path.at(-1)?.source ?? 'Saved variation' });
      if (next !== variationStudy && action.type !== 'variation-select' && action.type !== 'variation-undo') setVariationHistory(values => [...values.slice(-19), variationStudy]);
      setVariationStudy(next);
      setVariationError('');
      try { localStorage.setItem(VARIATION_STORAGE_KEY, JSON.stringify(next)); }
      catch { setVariationError('The study is available in this session, but local storage could not save it. Export JSON to keep a copy.'); }
    } catch (error) { setVariationError(error instanceof Error ? error.message : 'Could not update the study.'); }
  };
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<AnalysisAction>(ANALYSIS_ACTION_EVENT, event => onAction(event.payload)).then(fn => { if (disposed) fn(); else unlisten = fn; });
    return () => { disposed = true; unlisten?.(); };
  }, [onAction]);
  const auxiliaryHandler = useRef<(action: AuxiliaryAction) => void>(() => {});
  auxiliaryHandler.current = action => {
    if (action.type === 'thinking-clear' || action.type === 'thinking-preview') thinkingAction(action);
    else if (action.type === 'mate-start' || action.type === 'mate-stop') mate.onAction(action);
    else if (action.type === 'comparison-start' || action.type === 'comparison-stop') comparison.onAction(action as ComparisonAction);
    else if (action.type.startsWith('variation-')) variationAction(action as VariationAction);
    else if (action.type === 'continuation-step') setContinuation(value => value ? normalizeContinuation({ ...value, step: action.step }) : value);
    else if (action.type === 'continuation-embed') embed();
    else if (action.type === 'continuation-detach') detach();
    else if (action.type === 'continuation-change') updateContinuation(action.value);
    else if (action.type === 'review-start') startReview(action.engineId, action.seconds, action.scope);
    else if (action.type === 'review-stop') review.stop();
    else if (action.type === 'review-preview') {
      const row = review.state.rows.find(value => value.ply === action.ply);
      if (row && row.rootSfen === action.rootSfen && action.snapshot === reviewSnapshotKey(review.state) && (!action.best || row.bestLine.length > 0)) previewReview(row, action.best);
    }
  };
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<AuxiliaryAction>(AUXILIARY_ACTION_EVENT, event => auxiliaryHandler.current(event.payload)).then(fn => { if (disposed) fn(); else unlisten = fn; });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const { poppedOut, error, popOut } = useSecondaryWindowHost(CANDIDATE_WINDOW_CONFIG, analysisPayload, onDismiss, () => { if (!isVisible) onToggle(); }, { visible: isVisible, onShow: onToggle });
  const openView = (view: SecondaryView) => {
    const focusWindow = (label: string) => void WebviewWindow.getByLabel(label).then(async win => { if (win) { await win.show(); await win.setFocus(); } }).catch(console.error);
    if (view === 'usi') { focusSecondaryPanel('usi-monitor'); onOpenUsi?.(); focusWindow('usi-monitor'); return; }
    if (view === 'evaluation') { focusSecondaryPanel('evaluation'); onOpenEvaluation?.(); focusWindow('evaluation-monitor'); return; }
    if (view === 'candidates') { focusSecondaryPanel('candidates'); if (poppedOut) void popOut(); else if (!isVisible) onToggle(); return; }
    if (view === 'continuation') detach();
    else if (view === 'mate') setMateVisible(true);
    else if (view === 'comparison') setComparisonVisible(true);
    else if (view === 'thinking') setThinkingVisible(true);
    else if (view === 'review') setReviewVisible(true);
    const config = { continuation: CONTINUATION_CONFIG, mate: MATE_CONFIG, comparison: COMPARISON_CONFIG, thinking: THINKING_CONFIG, review: REVIEW_CONFIG }[view];
    focusSecondaryPanel(config.label);
    void WebviewWindow.getByLabel(config.label).then(async win => { if (win) { await win.show(); await win.setFocus(); } }).catch(console.error);
  };
  const available = (view: SecondaryView) => view === 'usi' ? Boolean(onOpenUsi) : view === 'evaluation' ? Boolean(onOpenEvaluation) : true;
  useSecondaryViewShortcuts(toggleSecondaryView, available);
  useEffect(() => {
    const open = (event: Event) => {
      const view = (event as CustomEvent<SecondaryView>).detail;
      if (secondaryViews.some(([id]) => id === view) && available(view)) openView(view);
    };
    window.addEventListener(SECONDARY_VIEW_OPEN_EVENT, open);
    return () => window.removeEventListener(SECONDARY_VIEW_OPEN_EVENT, open);
  });
  return <>
    <section hidden={poppedOut || !isVisible} className="secondary-panel-dock" aria-label="Candidate Moves panel">

              <SecondaryPanelFrame id="candidates" active={isVisible && !poppedOut}>{(floating, dock) =>
          <CandidateMoves payload={analysisPayload} onAnalysisAction={onAction} onContinuationChange={updateContinuation} onDetachContinuation={detach} onEmbedContinuation={embed} isVisible onToggle={onToggle} onDock={floating ? dock : undefined} onPopOut={() => void popOut()} />
        }</SecondaryPanelFrame>
      {error && <p role="alert">{error}</p>}
    </section>
    <AnalysisPanelHost visible={detached} onReturn={detach} config={CONTINUATION_CONFIG} payload={analysisPayload} onDismiss={dismissContinuation}>
      <button onClick={embed}>Reattach to Candidate Moves</button>{continuation && <ContinuationBoard value={continuation} onAddMove={move => variationAction({ type: 'variation-board-add', ...move })} onStep={step => updateContinuation({ ...continuation, step })} pieceThemeType={payload.pieceThemeType} boardBackground={payload.boardBackground} />}
      <VariationTree canLoadGame={Boolean(onLoadStudyGame)} study={variationStudy} continuation={continuation} error={variationError} canUndo={variationHistory.length > 0} onAction={variationAction} />
    </AnalysisPanelHost>
    <AnalysisPanelHost visible={thinkingVisible} onReturn={() => setThinkingVisible(true)} config={THINKING_CONFIG} payload={thinkingPayload} onDismiss={dismissThinking}><EngineThinking payload={thinkingPayload} onHistoryAction={thinkingAction} /></AnalysisPanelHost>
    <AnalysisPanelHost visible={mateVisible} onReturn={() => setMateVisible(true)} config={MATE_CONFIG} payload={analysisPayload} onDismiss={dismissMate}>
      <MateSearch state={mate.state} engines={analysisPayload.mate!.engines} capabilities={mate.capabilities} currentSfen={payload.currentSfen} onAction={mate.onAction} onPreview={value => { updateContinuation(value); setDetached(true); }} />
    </AnalysisPanelHost>
    <AnalysisPanelHost visible={comparisonVisible} onReturn={() => setComparisonVisible(true)} config={COMPARISON_CONFIG} payload={analysisPayload} onDismiss={dismissComparison}>
      <EngineComparison state={comparison.state} engines={analysisPayload.comparison!.engines} currentSfen={payload.currentSfen} onAction={comparison.onAction} onPreview={value => { updateContinuation(value); setDetached(true); }} />
    </AnalysisPanelHost>
    <AnalysisPanelHost visible={reviewVisible} onReturn={() => setReviewVisible(true)} config={REVIEW_CONFIG} payload={analysisPayload} onDismiss={dismissReview}>
      <GameReview state={review.state} record={record} branch={branchRecord} engines={engines} onStart={startReview} onStop={review.stop} onPreview={previewReview} />
    </AnalysisPanelHost>
  </>;
}
